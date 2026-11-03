// Desktop-only storage: deliberately independent from Web favorites and host preferences.
export const FAVORITES_KEY = 'dsh-cgss-desktop-idol-favorites-v1';

export function readFavorites(storage, characters) {
  try {
    const value = JSON.parse(storage?.getItem(FAVORITES_KEY) ?? '[]');
    const known = new Set(characters.map(character => character.id));
    return new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string' && known.has(id)) : []);
  } catch { return new Set(); }
}

export function writeFavorites(storage, favorites) {
  try { storage?.setItem(FAVORITES_KEY, JSON.stringify([...favorites])); } catch { /* Keep working in memory if storage is unavailable. */ }
}

export function filterIdols(characters, query, favorites, matches) {
  const filtered = characters.filter(character => matches(character, query));
  // Stable partition: never reorder either group relative to the catalog.
  return [...filtered.filter(character => favorites.has(character.id)), ...filtered.filter(character => !favorites.has(character.id))];
}

export function createIdolPicker({ root, input, list, favorite, empty, characters, matches, selectedId, onSelect, storage, eventTarget = globalThis.window }) {
  const document = input.ownerDocument;
  const favorites = readFavorites(storage, characters);
  let selected = selectedId, query = '', open = false, composing = false, active = null, visible = [];
  const find = id => characters.find(character => character.id === id);
  const label = character => character ? character.name + (character.available === false ? '（待收录）' : '') : '';
  const listeners = [];
  function listen(node, type, handler) {
    node?.addEventListener(type, handler);
    listeners.push(() => node?.removeEventListener(type, handler));
  }
  function updateFavorite() {
    const character = find(selected), saved = favorites.has(selected);
    favorite.textContent = saved ? '★' : '☆';
    favorite.classList.toggle('is-favorite', saved);
    favorite.disabled = !character;
    favorite.setAttribute('aria-pressed', String(saved));
    favorite.title = favorite.ariaLabel = (saved ? '取消收藏' : '收藏') + (character?.name ?? '当前偶像');
    favorite.setAttribute('aria-label', favorite.title);
  }
  function render() {
    visible = filterIdols(characters, query, favorites, matches);
    if (!visible.some(character => character.id === active && character.available !== false)) active = visible.find(character => character.available !== false)?.id ?? null;
    input.setAttribute('aria-expanded', String(open));
    list.hidden = !open;
    empty.hidden = !open || visible.length > 0;
    list.replaceChildren();
    input.removeAttribute('aria-activedescendant');
    for (const character of visible) {
      const option = document.createElement('div');
      option.id = list.id + '-option-' + characters.indexOf(character);
      option.className = 'idol-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(character.id === selected));
      option.setAttribute('aria-disabled', String(character.available === false));
      option.classList.toggle('is-active', character.id === active);
      const star = document.createElement('span');
      star.className = 'idol-option-star';
      star.textContent = favorites.has(character.id) ? '★' : '';
      star.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.textContent = label(character);
      option.setAttribute('aria-label', label(character) + (favorites.has(character.id) ? '，已收藏' : ''));
      option.append(star, name);
      option.addEventListener('pointerdown', event => event.preventDefault());
      option.addEventListener('click', () => choose(character.id));
      list.append(option);
      if (open && character.id === active) input.setAttribute('aria-activedescendant', option.id);
    }
    updateFavorite();
  }
  function close() {
    open = false; composing = false; query = ''; active = selected;
    input.value = label(find(selected));
    render();
  }
  function show() {
    if (open) return;
    open = true; query = ''; active = selected;
    render();
    input.select();
  }
  function choose(id) {
    if (composing || find(id)?.available === false || !find(id)) return;
    const changed = selected !== id;
    selected = id;
    close();
    if (changed) onSelect(id);
  }
  function search() {
    if (composing) return;
    query = input.value; open = true; active = null; render();
  }
  listen(input, 'focus', show);
  listen(input, 'click', show);
  listen(input, 'input', search);
  listen(input, 'compositionstart', () => { composing = true; });
  listen(input, 'compositionend', () => { if (composing) { composing = false; search(); } });
  listen(input, 'keydown', event => {
    if (composing || event.isComposing || event.keyCode === 229) {
      // Do not let an IME Escape bubble to the panel's close shortcut.
      event.stopPropagation();
      return;
    }
    if (event.key === 'Escape') {
      if (open) { event.preventDefault(); event.stopPropagation(); close(); }
      return;
    }
    if (event.key === 'Enter') {
      if (open) { event.preventDefault(); event.stopPropagation(); if (active) choose(active); }
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!open) { show(); return; }
    const enabled = visible.filter(character => character.available !== false);
    if (!enabled.length) return;
    const index = enabled.findIndex(character => character.id === active);
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    active = enabled[(index + direction + enabled.length) % enabled.length].id;
    render();
    const option = document.getElementById(input.getAttribute('aria-activedescendant'));
    option?.scrollIntoView?.({ block: 'nearest' });
  });
  listen(root, 'focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
  listen(document, 'pointerdown', event => { if (!root.contains(event.target)) close(); });
  listen(eventTarget, 'blur', close);
  listen(favorite, 'click', () => {
    if (!find(selected)) return;
    if (favorites.has(selected)) favorites.delete(selected); else favorites.add(selected);
    writeFavorites(storage, favorites);
    render();
  });
  listen(eventTarget, 'storage', event => {
    if (event.key !== FAVORITES_KEY && event.key !== null) return;
    if (event.storageArea && event.storageArea !== storage) return;
    const saved = readFavorites(storage, characters);
    favorites.clear();
    for (const id of saved) favorites.add(id);
    render();
  });
  close();
  return {
    setSelected(id, force = false) {
      if (!find(id) || (!force && id === selected)) return;
      selected = id; close();
    },
    close,
    destroy() { for (const remove of listeners) remove(); },
  };
}
