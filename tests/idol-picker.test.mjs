import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadTheme } from './helpers/theme-harness.mjs';
import { CHARACTER_LIST, CHARACTERS } from '../lib/characters.js';

const STORAGE_KEY = 'dsh-cgss-idol-theme:favorite-idols:v1';
const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.children)] : [];
const find = (tree, predicate) => nodes(tree).find(predicate);
const byRole = (tree, role) => find(tree, node => node.props?.role === role);
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.children) : typeof tree === 'string' ? tree : '';
const event = overrides => ({ prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...overrides });

// Small hook host: execute the actual registered components, including effects and cleanup,
// without introducing a React/DOM dependency into this plugin's Node test suite.
function hookHost() {
  let current, nextId = 0;
  const react = {
    useState(initial) {
      const host = current, index = host.cursor++;
      if (!(index in host.hooks)) host.hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [host.hooks[index], value => {
        const next = typeof value === 'function' ? value(host.hooks[index]) : value;
        if (!Object.is(next, host.hooks[index])) { host.hooks[index] = next; host.dirty = true; }
      }];
    },
    useRef(initial) {
      const host = current, index = host.cursor++;
      return host.hooks[index] ??= { current: initial };
    },
    useId() { return react.useRef('picker-' + nextId++).current; },
    useEffect(effect, deps) {
      const host = current, index = host.cursor++, previous = host.hooks[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        host.effects.push(() => { previous?.cleanup?.(); host.hooks[index] = { deps, cleanup: effect() }; });
      }
    },
  };
  return { react, mount(component, props) {
    const host = { hooks: [], cursor: 0, effects: [], dirty: false };
    return {
      render() {
        for (let round = 0; round < 20; round++) {
          const resolvedProps = props();
          host.cursor = 0; host.effects = []; host.dirty = false; current = host;
          host.tree = component(resolvedProps);
          for (const node of nodes(host.tree)) if (node.props?.ref) node.props.ref.current = { scrollIntoView: () => { host.scrolled = true; } };
          host.effects.forEach(run => run());
          if (!host.dirty) return host.tree;
        }
        throw new Error('Hook render did not settle');
      },
      get scrolled() { return host.scrolled; },
      dispose() { host.hooks.forEach(hook => hook?.cleanup?.()); },
    };
  } };
}

function memoryStorage(initial) {
  const data = new Map(initial === undefined ? [] : [[STORAGE_KEY, initial]]);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
}

function setup(storage = memoryStorage()) {
  const host = hookHost(), listeners = new Map();
  const theme = loadTheme({ react: host.react, browserWindow: {
    localStorage: storage, innerWidth: 1400, innerHeight: 900,
    addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
  } });
  const petNode = () => theme.render().children[1];
  const pet = host.mount(petNode().type, () => petNode().props);
  const image = find(pet.render(), node => node.props?.role === 'button');
  image.props.onKeyDown(event({ key: 'ContextMenu' }));
  const pickerNode = () => find(pet.render(), node => node.type?.name === 'IdolPicker');
  assert.ok(pickerNode(), 'the pet panel mounts the combined picker');
  const picker = host.mount(pickerNode().type, () => pickerNode().props);
  const render = () => picker.render();
  const input = () => byRole(render(), 'combobox');
  const options = () => nodes(render()).filter(node => node.props?.role === 'option');
  const favorite = () => find(render(), node => node.type === 'button' && 'aria-pressed' in node.props);
  const api = { theme, pet, picker, listeners, storage, render, input, options, favorite,
    focus: () => { input().props.onFocus(); render(); },
    change: value => { input().props.onChange({ target: { value } }); render(); },
    key: (key, extra = {}) => { const e = event({ key, ...extra }); input().props.onKeyDown(e); render(); return e; },
    emitStorage: e => { listeners.get('storage')?.forEach(fn => fn(e)); render(); },
    dispose: () => { picker.dispose(); pet.dispose(); theme.dispose(); },
  };
  render();
  return api;
}
const optionNames = picker => picker.options().map(node => node.props['aria-label'].split('，')[0]);
const active = picker => picker.options().find(node => node.props.id === picker.input().props['aria-activedescendant']);

test('one searchable combobox replaces both controls and searches names, romanization and ids', t => {
  const p = setup(); t.after(p.dispose);
  assert.equal(nodes(p.render()).filter(node => node.type === 'input').length, 1);
  assert.equal(nodes(p.render()).filter(node => node.type === 'select').length, 0);
  assert.equal(p.input().props.value, '佐城雪美');
  assert.equal(p.input().props['aria-expanded'], false);
  p.focus();
  assert.equal(p.input().props['aria-controls'], byRole(p.render(), 'listbox').props.id);
  assert.equal(p.options().length, CHARACTER_LIST.length);
  p.change('  SAJO  YUKIMI  ');
  assert.deepEqual(optionNames(p), ['佐城雪美']);
  p.change('橘爱丽丝');
  assert.deepEqual(optionNames(p), ['橘爱丽丝']);
  p.change('arisu');
  assert.deepEqual(optionNames(p), ['橘爱丽丝']);
  assert.equal(p.theme.preferences.getSnapshot().characterId, 'yukimi', 'typing does not select');
});

test('clear, empty results, blur, Escape and Tab never silently change the selection', t => {
  const p = setup(); t.after(p.dispose);
  p.focus(); p.key('ArrowDown');
  assert.ok(active(p));
  p.change('no-such-idol-12345');
  assert.equal(p.options().length, 0, 'selected idol is not injected into unmatched results');
  assert.match(text(byRole(p.render(), 'status')), /没有匹配/);
  assert.equal(p.input().props['aria-activedescendant'], undefined);
  p.key('ArrowDown'); p.key('Enter');
  assert.equal(p.theme.preferences.getSnapshot().characterId, 'yukimi');
  p.change(''); assert.equal(p.options().length, CHARACTER_LIST.length);
  p.change('arisu'); p.input().props.onBlur();
  assert.equal(p.input().props.value, '佐城雪美');
  assert.equal(p.input().props['aria-expanded'], false);
  p.focus(); assert.equal(p.options().length, CHARACTER_LIST.length);
  p.change('arisu'); p.key('ArrowDown');
  assert.equal(p.key('Escape').prevented, true);
  assert.equal(p.input().props.value, '佐城雪美');
  p.focus(); p.change('arisu'); p.key('ArrowDown');
  assert.equal(p.key('Tab').prevented, false, 'Tab remains native focus navigation');
  assert.equal(p.input().props['aria-expanded'], false);
  assert.equal(p.theme.preferences.getSnapshot().characterId, 'yukimi');
});

test('keyboard navigation tracks real options, skips unavailable idols and commits with Enter', t => {
  const p = setup(); t.after(p.dispose);
  p.key('ArrowDown');
  assert.ok(active(p));
  assert.equal(p.picker.scrolled, true);
  p.key('End');
  const enabled = p.options().filter(node => !node.props['aria-disabled']);
  assert.equal(active(p).props.id, enabled.at(-1).props.id);
  p.key('ArrowDown'); assert.equal(active(p).props.id, enabled.at(-1).props.id);
  p.key('Home'); assert.equal(active(p).props.id, enabled[0].props.id);
  p.key('ArrowUp'); assert.equal(active(p).props.id, enabled[0].props.id);
  p.change('arisu'); p.key('ArrowDown');
  assert.match(active(p).props['aria-label'], /橘爱丽丝/);
  assert.equal(p.key('Enter').prevented, true);
  assert.equal(p.theme.preferences.getSnapshot().characterId, 'arisu');
  assert.equal(p.theme.preferences.getSnapshot().bg, CHARACTERS.arisu.defaults.bg);
  assert.equal(p.input().props.value, '橘爱丽丝');
  assert.equal(p.input().props['aria-activedescendant'], undefined);
  p.focus();
  const unavailable = p.options().find(node => node.props['aria-disabled']);
  assert.ok(unavailable);
  unavailable.props.onClick();
  assert.equal(p.theme.preferences.getSnapshot().characterId, 'arisu');
  p.change(unavailable.props['aria-label'].split('，')[0]);
  p.key('ArrowDown'); p.key('Enter');
  assert.equal(p.theme.preferences.getSnapshot().characterId, 'arisu');
});

test('Chinese IME confirmation and navigation are never intercepted, including legacy keyCode 229', t => {
  const p = setup(); t.after(p.dispose);
  p.focus(); p.change('arisu'); p.key('ArrowDown');
  p.input().props.onCompositionStart();
  p.change('橘爱丽丝');
  for (const key of ['Enter', 'Escape', 'ArrowDown', 'Tab']) assert.equal(p.key(key).prevented, false);
  assert.equal(p.input().props['aria-expanded'], true);
  p.input().props.onCompositionEnd(); p.key('ArrowDown');
  for (const extra of [{ isComposing: true }, { nativeEvent: { isComposing: true } }, { keyCode: 229 }, { nativeEvent: { keyCode: 229 } }]) {
    assert.equal(p.key('Enter', extra).prevented, false);
    assert.equal(p.theme.preferences.getSnapshot().characterId, 'yukimi');
  }
  p.key('Enter'); assert.equal(p.theme.preferences.getSnapshot().characterId, 'arisu');
});

test('pointer selection retains input focus and external selection restores the committed display', t => {
  const p = setup(); t.after(p.dispose);
  p.focus(); p.change('arisu');
  const option = p.options()[0], e = event();
  option.props.onPointerDown(e); assert.equal(e.prevented, true);
  option.props.onClick();
  assert.equal(p.input().props.value, '橘爱丽丝');
  p.input().props.onClick(); assert.equal(p.input().props['aria-expanded'], true);
  p.change('yukimi'); p.theme.update({ characterId: 'uzuki' });
  assert.equal(p.input().props.value, CHARACTERS.uzuki.name);
  assert.equal(p.input().props['aria-expanded'], false);
});

test('orange star toggles persist across fresh loads and favorites lead in original roster order', t => {
  const storage = memoryStorage(JSON.stringify(['arisu', 'uzuki']));
  const p = setup(storage); t.after(p.dispose);
  p.focus();
  const favorites = new Set(['arisu', 'uzuki']);
  const expected = [...CHARACTER_LIST.filter(c => favorites.has(c.id)), ...CHARACTER_LIST.filter(c => !favorites.has(c.id))].map(c => c.name);
  assert.deepEqual(optionNames(p), expected);
  assert.match(p.options()[0].props['aria-label'], /已收藏/);
  assert.match(text(p.options()[0]), /★/);
  assert.equal(p.favorite().props['aria-pressed'], false);
  p.favorite().props.onClick();
  assert.equal(p.favorite().props['aria-pressed'], true);
  assert.equal(p.favorite().props.style.color, '#c65d00');
  assert.equal(text(p.favorite()), '★');
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), ['arisu', 'uzuki', 'yukimi']);
  assert.equal('favorites' in p.theme.preferences.getSnapshot(), false);
  assert.equal(optionNames(p)[0], '佐城雪美');
  p.change('arisu'); assert.deepEqual(optionNames(p), ['橘爱丽丝'], 'filter still applies to favorites');
  const refreshed = setup(storage); t.after(refreshed.dispose);
  assert.equal(refreshed.favorite().props['aria-pressed'], true);
  refreshed.favorite().props.onClick();
  assert.equal(text(refreshed.favorite()), '☆');
  const again = setup(storage); t.after(again.dispose);
  assert.equal(again.favorite().props['aria-pressed'], false);
  again.focus(); assert.deepEqual(optionNames(again), expected);
});

test('malformed and unavailable storage cannot break selection or in-memory favorites', t => {
  for (const initial of ['{bad json', '{}', 'null', '42', '[null,4,"__proto__","missing","arisu","arisu"]']) {
    const p = setup(memoryStorage(initial)); t.after(p.dispose);
    p.focus(); assert.equal(p.options().length, CHARACTER_LIST.length);
    p.favorite().props.onClick(); assert.equal(p.favorite().props['aria-pressed'], true);
    const saved = JSON.parse(p.storage.getItem(STORAGE_KEY));
    assert.ok(saved.every(id => id === 'arisu' || id === 'yukimi'));
    assert.equal(saved.length, new Set(saved).size);
  }
  const p = setup({ getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } });
  t.after(p.dispose);
  p.favorite().props.onClick(); assert.equal(p.favorite().props['aria-pressed'], true);
  p.focus(); p.change('arisu'); p.key('ArrowDown'); p.key('Enter');
  assert.equal(p.theme.preferences.getSnapshot().characterId, 'arisu');
});

test('storage events refresh favorites across tabs, clear correctly and clean up listeners', () => {
  const p = setup(); p.focus();
  p.storage.setItem(STORAGE_KEY, '["arisu"]');
  p.emitStorage({ key: 'unrelated' }); assert.equal(optionNames(p)[0], '佐城雪美');
  p.emitStorage({ key: STORAGE_KEY, storageArea: {} }); assert.equal(optionNames(p)[0], '佐城雪美');
  p.emitStorage({ key: STORAGE_KEY, storageArea: p.storage }); assert.equal(optionNames(p)[0], '橘爱丽丝');
  p.storage.removeItem(STORAGE_KEY); p.emitStorage({ key: null, storageArea: p.storage });
  assert.equal(optionNames(p)[0], '佐城雪美');
  p.dispose(); assert.equal(p.listeners.get('storage').size, 0);
});

test('focused picker panel cancels the inactivity timeout until focus leaves the whole panel', t => {
  const p = setup(); t.after(p.dispose);
  const panel = () => find(p.pet.render(), node => node.props?.className === 'yukimi-pet-panel');
  assert.ok([...p.theme.timeouts].some(timer => timer.delay === 6000));
  panel().props.onFocus();
  assert.equal([...p.theme.timeouts].some(timer => timer.delay === 6000), false);
  panel().props.onPointerDown();
  assert.equal([...p.theme.timeouts].some(timer => timer.delay === 6000), false);
  panel().props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: {} });
  assert.equal([...p.theme.timeouts].some(timer => timer.delay === 6000), false);
  panel().props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null });
  const timer = [...p.theme.timeouts].find(timer => timer.delay === 6000);
  assert.ok(timer); timer.fn(); assert.equal(panel(), undefined);
});
