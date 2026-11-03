import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createIdolPicker, filterIdols, readFavorites, writeFavorites, FAVORITES_KEY } from '../desktop/idol-picker.js';
import { CHARACTER_LIST, matchesCharacter } from '../lib/characters.js';

const characters = [
  { id: 'a', name: '雪美', search: 'yukimi', available: true },
  { id: 'b', name: '待收录', search: 'pending', available: false },
  { id: 'c', name: '凛', search: 'rin', available: true },
  { id: 'd', name: '卯月', search: 'uzuki', available: true },
];
const ids = items => items.map(item => item.id);
function memory(value = '[]') {
  const data = new Map([[FAVORITES_KEY, value]]);
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
class Element {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument; this.children = []; this.listeners = new Map(); this.attributes = new Map();
    this.value = ''; this.hidden = false; this.textContent = '';
    const classes = new Set();
    this.classList = { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) };
  }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatch(type, data = {}) {
    const event = { target: this, prevented: false, stopped: false, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...data };
    for (const fn of this.listeners.get(type) ?? []) fn(event);
    return event;
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  contains(node) { return this === node || this.children.some(child => child.contains(node)); }
  select() { this.selectedText = true; }
  scrollIntoView() { this.scrolled = true; }
}
function fixture(storage = memory()) {
  const document = new Element();
  document.createElement = () => new Element(document);
  const root = document.createElement();
  document.getElementById = id => {
    const walk = node => node.id === id ? node : node.children.map(walk).find(Boolean);
    return walk(root);
  };
  const input = document.createElement(), list = document.createElement(), favorite = document.createElement(), empty = document.createElement();
  list.id = 'options'; root.append(input, list, favorite, empty);
  const eventTarget = new Element(), selections = [];
  const picker = createIdolPicker({ root, input, list, favorite, empty, characters, matches: matchesCharacter, selectedId: 'a', storage, eventTarget, onSelect: id => selections.push(id) });
  const search = query => { input.value = query; input.dispatch('input'); };
  const key = (key, data = {}) => input.dispatch('keydown', { key, ...data });
  const names = () => list.children.map(option => option.children[1].textContent);
  return { root, input, list, favorite, empty, document, eventTarget, selections, picker, search, key, names, storage };
}

test('favorite-first stable partition preserves catalog order, including filtered results', () => {
  const favorites = new Set(['d', 'a']);
  assert.deepEqual(ids(filterIdols(characters, '', favorites, matchesCharacter)), ['a', 'd', 'b', 'c']);
  assert.deepEqual(ids(filterIdols(characters, '  U  ', favorites, matchesCharacter)), ['a', 'd']);
  assert.deepEqual(ids(filterIdols(characters, 'not-found', favorites, matchesCharacter)), []);
  const actual = filterIdols(CHARACTER_LIST, 'YUKIMI', new Set(['yukimi']), matchesCharacter);
  assert.ok(actual.some(character => character.id === 'yukimi'));
});

test('storage validates JSON, deduplicates IDs, rejects stale data and tolerates blocked storage', () => {
  assert.deepEqual([...readFavorites(memory('["d","a","d","missing",1,null]'), characters)], ['d', 'a']);
  for (const raw of ['bad json', '{}', 'null', '123']) assert.equal(readFavorites(memory(raw), characters).size, 0);
  const blocked = { getItem() { throw Error('denied'); }, setItem() { throw Error('full'); } };
  assert.equal(readFavorites(blocked, characters).size, 0);
  assert.doesNotThrow(() => writeFavorites(blocked, new Set(['a'])));
  assert.doesNotThrow(() => writeFavorites(undefined, new Set(['a'])));
});

test('favorite star toggles and persists without changing the selected character', () => {
  const f = fixture();
  assert.equal(f.favorite.textContent, '☆');
  f.favorite.dispatch('click');
  assert.equal(f.favorite.textContent, '★');
  assert.equal(f.favorite.getAttribute('aria-pressed'), 'true');
  assert.equal(f.favorite.classList.contains('is-favorite'), true);
  assert.equal(f.list.children[0].children[0].textContent, '★');
  assert.deepEqual(f.selections, []);
  const restored = fixture(f.storage);
  assert.equal(restored.favorite.textContent, '★');
  restored.favorite.dispatch('click');
  assert.equal(restored.favorite.textContent, '☆');
  assert.deepEqual([...readFavorites(f.storage, characters)], []);
});

test('keyboard arrows skip unavailable idols, Enter selects, Escape restores without selecting', () => {
  const f = fixture();
  f.input.dispatch('focus');
  assert.equal(f.input.getAttribute('aria-expanded'), 'true');
  f.key('ArrowDown');
  assert.equal(f.input.getAttribute('aria-activedescendant'), 'options-option-2');
  f.key('Enter');
  assert.deepEqual(f.selections, ['c']);
  assert.equal(f.input.value, '凛');
  assert.equal(f.list.hidden, true);
  f.key('ArrowUp'); // Reopen without committing.
  f.key('ArrowUp');
  assert.equal(f.input.getAttribute('aria-activedescendant'), 'options-option-0');
  const escape = f.key('Escape');
  assert.equal(escape.stopped, true);
  assert.equal(f.input.value, '凛');
  assert.deepEqual(f.selections, ['c']);
  assert.equal(f.key('Escape').stopped, false); // A second Escape may close the panel.
});

test('empty and disabled-only results cannot select a stale active option', () => {
  const f = fixture();
  f.search('no match');
  assert.equal(f.empty.hidden, false);
  assert.equal(f.input.getAttribute('aria-activedescendant'), null);
  f.key('ArrowDown'); f.key('Enter');
  assert.deepEqual(f.selections, []);
  f.search('pending');
  assert.equal(f.empty.hidden, true);
  assert.equal(f.list.children[0].getAttribute('aria-disabled'), 'true');
  f.list.children[0].dispatch('click'); f.key('Enter');
  assert.deepEqual(f.selections, []);
});

test('IME composition defers filtering and never treats confirmation or Escape as picker commands', () => {
  const f = fixture();
  f.input.dispatch('focus');
  f.input.dispatch('compositionstart');
  f.search('凛');
  assert.equal(f.list.children.length, 4);
  const enter = f.key('Enter', { isComposing: true });
  assert.equal(enter.prevented, false);
  assert.equal(f.key('Escape', { keyCode: 229 }).stopped, true);
  assert.deepEqual(f.selections, []);
  f.input.dispatch('compositionend');
  assert.deepEqual(f.names(), ['凛']);
  f.key('Enter', { keyCode: 229 });
  assert.deepEqual(f.selections, []);
  f.key('Enter');
  assert.deepEqual(f.selections, ['c']);
});

test('pointer choice preserves input focus and external blur restores the selected label', () => {
  const f = fixture();
  f.search('rin');
  assert.equal(f.list.children[0].dispatch('pointerdown').prevented, true);
  f.list.children[0].dispatch('click');
  assert.deepEqual(f.selections, ['c']);
  f.search('uzuki');
  f.root.dispatch('focusout', { relatedTarget: f.favorite });
  assert.equal(f.list.hidden, false);
  f.root.dispatch('focusout', { relatedTarget: null });
  assert.equal(f.list.hidden, true);
  assert.equal(f.input.value, '凛');
  f.input.dispatch('click');
  f.document.dispatch('pointerdown', { target: new Element() });
  assert.equal(f.list.hidden, true);
  f.input.dispatch('click'); f.eventTarget.dispatch('blur');
  assert.equal(f.list.hidden, true);
});

test('external character sync and load rollback clear stale queries and refresh favorite state', () => {
  const f = fixture(memory('["d"]'));
  f.search('rin');
  f.picker.setSelected('a'); // Unrelated same-character updates preserve typing.
  assert.equal(f.input.value, 'rin');
  f.picker.setSelected('d');
  assert.equal(f.input.value, '卯月');
  assert.equal(f.favorite.textContent, '★');
  assert.equal(f.list.hidden, true);
  f.search('rin'); f.key('Enter');
  f.picker.setSelected('d', true); // Sprite load failed.
  assert.equal(f.input.value, '卯月');
  assert.equal(f.favorite.textContent, '★');
  f.input.dispatch('compositionstart');
  f.picker.setSelected('a', true);
  f.input.dispatch('compositionend');
  assert.equal(f.list.hidden, true);
  assert.deepEqual(f.selections, ['c']);
});

test('storage events refresh desktop favorites and destroy removes global listeners', () => {
  const f = fixture();
  f.storage.setItem(FAVORITES_KEY, '["d","a"]');
  f.eventTarget.dispatch('storage', { key: FAVORITES_KEY, storageArea: f.storage });
  assert.equal(f.favorite.textContent, '★');
  assert.deepEqual(f.names(), ['雪美', '卯月', '待收录（待收录）', '凛']);
  f.storage.setItem(FAVORITES_KEY, '[]');
  f.eventTarget.dispatch('storage', { key: 'web-favorites', storageArea: f.storage });
  assert.equal(f.favorite.textContent, '★');
  f.eventTarget.dispatch('storage', { key: null, storageArea: f.storage });
  assert.equal(f.favorite.textContent, '☆');
  f.picker.destroy();
  assert.equal([...f.eventTarget.listeners.values()].every(set => set.size === 0), true);
});

test('desktop markup and renderer use one combobox and explicitly independent local favorites', async () => {
  const html = await readFile(new URL('../desktop/index.html', import.meta.url), 'utf8');
  const renderer = await readFile(new URL('../desktop/renderer.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../desktop/style.css', import.meta.url), 'utf8');
  assert.equal((html.match(/role="combobox"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<select|id="character-select"/);
  assert.match(html, /与 Web 端独立/);
  assert.ok(renderer.includes('idolPicker.setSelected(preferences.characterId, true)'));
  assert.ok(renderer.includes('idolPicker.setSelected(character.id, true)'));
  assert.ok(css.includes('#character-favorite.is-favorite, .idol-option-star { color: #de7900;'));
});
