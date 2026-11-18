// Remembers which questions this browser has already shown, across matches and
// page reloads, so they don't come back. Stored as short hashes in localStorage.
const KEY = 'certamen.seen.v1';
const MAX = 5000;

let list = load();
let set = new Set(list);

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch { return []; }
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* storage full or blocked */ }
}

/** Stable short key for a question text (FNV-1a hash of the normalised text). */
export function qKey(text) {
  const s = String(text).toLowerCase().replace(/[^a-z0-9]+/g, '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function markSeen(key) {
  if (!key || set.has(key)) return;
  set.add(key);
  list.push(key);
  if (list.length > MAX) set.delete(list.shift());
  save();
}

/** The most recent keys, e.g. to send to the host when joining. */
export function seenList(limit = 2000) {
  return list.slice(-limit);
}

export function isSeenHere(key) {
  return set.has(key);
}

export function seenCount() {
  return list.length;
}
