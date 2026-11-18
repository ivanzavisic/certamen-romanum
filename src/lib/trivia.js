// Questions come from Open Trivia DB (https://opentdb.com, CC BY-SA 4.0).
// The local bank in questions.js is only used as a fallback if the API fails.
import { QUESTIONS as LOCAL, THEMES as LOCAL_THEMES } from './questions.js';
import { log } from './log.svelte.js';

// Open Trivia DB categories offered in theme votes (tiny categories left out).
export const THEMES = [
  { id: 9, name: 'General Knowledge', latin: 'Scientia', icon: '📜' },
  { id: 10, name: 'Books', latin: 'Libri', icon: '📚' },
  { id: 11, name: 'Film', latin: 'Theatrum Lucis', icon: '🎬' },
  { id: 12, name: 'Music', latin: 'Musica', icon: '🎵' },
  { id: 13, name: 'Musicals & Theatre', latin: 'Scaena', icon: '🎭' },
  { id: 14, name: 'Television', latin: 'Televisio', icon: '📺' },
  { id: 15, name: 'Video Games', latin: 'Ludi Electrici', icon: '🎮' },
  { id: 16, name: 'Board Games', latin: 'Ludi Tabulae', icon: '🎲' },
  { id: 17, name: 'Science & Nature', latin: 'Natura', icon: '🌿' },
  { id: 18, name: 'Computers', latin: 'Machinae', icon: '💻' },
  { id: 19, name: 'Mathematics', latin: 'Mathematica', icon: '📐' },
  { id: 20, name: 'Mythology', latin: 'Mythologia', icon: '⚡' },
  { id: 21, name: 'Sports', latin: 'Certamina', icon: '🏆' },
  { id: 22, name: 'Geography', latin: 'Geographia', icon: '🗺️' },
  { id: 23, name: 'History', latin: 'Historia', icon: '🏛️' },
  { id: 27, name: 'Animals', latin: 'Animalia', icon: '🦁' },
  { id: 28, name: 'Vehicles', latin: 'Vehicula', icon: '🛞' },
  { id: 29, name: 'Comics', latin: 'Fabulae Pictae', icon: '💥' },
  { id: 31, name: 'Anime & Manga', latin: 'Pictura Iaponica', icon: '🌸' },
  { id: 32, name: 'Cartoons', latin: 'Imagines Motae', icon: '🐭' },
];

// Which backup-bank themes fit each API category. Categories with no good match
// map to [] — a backup question there is shown under its own theme's label, so
// the screen never claims e.g. "Geography" for a biology question.
const BACKUP_THEMES = {
  9: null, // General Knowledge: anything fits
  10: ['arts'], 11: ['screen'], 12: ['music'], 13: ['music', 'arts'], 14: ['screen'],
  15: [], 16: [], 17: ['science', 'space'], 18: [], 19: [], 20: ['myth'],
  21: ['sport'], 22: ['geo'], 23: ['history', 'rome'], 27: [], 28: [], 29: [], 31: [], 32: [],
};

const API = 'https://opentdb.com';
const GAP_MS = 5_200; // API allows one request per 5 s per IP
const MAX_ATTEMPTS = 5;
let token = null;
let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path) {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(API + path, { signal: AbortSignal.timeout(8_000) });
  if (res.status === 429) return { response_code: 5 }; // rate limited
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/** Get a session token early (e.g. while waiting for the rival) so it doesn't delay the first theme. */
export async function warmUp() {
  if (token) return;
  try {
    token = (await call('/api_token.php?command=request')).token || null;
    if (token) log('trivia API session ready');
  } catch (e) {
    log(`trivia API token failed (${e.message}) — will play without it`);
  }
}

/**
 * Fetch a batch of multiple-choice questions for one category. Never throws.
 * Retries on rate limits and token problems, and asks for fewer questions if
 * the category is running out.
 */
export async function fetchBatch(category) {
  if (!token) await warmUp();
  let amount = 12;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const tk = token ? `&token=${token}` : '';
      const j = await call(`/api.php?amount=${amount}&category=${category}&type=multiple&encode=url3986${tk}`);
      switch (j.response_code) {
        case 0:
          return j.results.map((r) => ({
            q: dec(r.question),
            a: dec(r.correct_answer),
            w: r.incorrect_answers.map(dec),
            level: r.difficulty,
          }));
        case 1: // not enough questions left in this category
          if (amount > 3) { amount = amount === 12 ? 6 : 3; break; }
          if (token) { log('category used up — resetting question history'); await call(`/api_token.php?command=reset&token=${token}`); amount = 12; }
          break;
        case 3: // token unknown/expired
          token = null;
          break;
        case 4: // token has seen every question here
          log('category used up — resetting question history');
          await call(`/api_token.php?command=reset&token=${token}`);
          break;
        case 5:
          log(`trivia API busy (attempt ${attempt}) — retrying`);
          break;
        default:
          log(`trivia API answered code ${j.response_code}`);
          return [];
      }
    } catch (e) {
      log(`trivia API error (attempt ${attempt}): ${e.message}`);
    }
  }
  return [];
}

/**
 * Difficulty 4..10 (nothing is rated 1-3), weighted towards the easy end with a
 * thin top tail so 9s and 10s are rare treats. Weights are percentages.
 * Average rating is about 5.5 (was 6.4 — lowered by ~15% on request).
 */
const DIFFICULTY_WEIGHTS = { 4: 30, 5: 27, 6: 21, 7: 12, 8: 7, 9: 2, 10: 1 };

export function rollDifficulty() {
  let r = Math.random() * 100;
  for (const [d, w] of Object.entries(DIFFICULTY_WEIGHTS)) {
    if ((r -= w) < 0) return Number(d);
  }
  return 7;
}

const levelOf = (d) => (d <= 5 ? 'easy' : d <= 8 ? 'medium' : 'hard');
const NEAREST = { easy: ['easy', 'medium', 'hard'], medium: ['medium', 'easy', 'hard'], hard: ['hard', 'medium', 'easy'] };

function pickNear(pool, d) {
  const best = Math.min(...pool.map((q) => Math.abs(q.d - d)));
  const near = pool.filter((q) => Math.abs(q.d - d) === best);
  return near[Math.floor(Math.random() * near.length)];
}

/**
 * Take one question out of the batch matching a rolled difficulty; falls back to
 * the local bank, staying inside the chosen theme whenever the bank covers it.
 * Returns `label` (a theme to display) only when the question is off-theme.
 */
export function takeQuestion(batch, usedLocal, category) {
  const d = rollDifficulty();
  for (const level of NEAREST[levelOf(d)]) {
    const i = batch.findIndex((q) => q.level === level);
    if (i >= 0) {
      const [q] = batch.splice(i, 1);
      // Keep the shown rating consistent with the API's own level.
      return { ...q, d: levelOf(d) === level ? d : { easy: 5, medium: 7, hard: 9 }[level], label: null };
    }
  }

  const fits = BACKUP_THEMES[category];
  const onTheme = (q) => fits === null || fits === undefined || fits.includes(q.t);
  let pool = LOCAL.filter((q) => onTheme(q) && !usedLocal.has(q));
  if (!pool.length) {
    // Recycle this theme's backup questions before going off-theme.
    LOCAL.filter(onTheme).forEach((q) => usedLocal.delete(q));
    pool = LOCAL.filter(onTheme);
  }
  let offTheme = false;
  if (!pool.length) {
    offTheme = true;
    pool = LOCAL.filter((q) => !usedLocal.has(q));
    if (!pool.length) { usedLocal.clear(); pool = LOCAL; }
  }
  const q = pickNear(pool, d);
  usedLocal.add(q);
  const own = LOCAL_THEMES.find((t) => t.id === q.t);
  log(`backup question used${offTheme ? ` (no backup for this theme — showing a ${own?.name} question)` : ''}`);
  return { q: q.q, a: q.a, w: q.w, d: q.d, label: offTheme && own ? { icon: own.icon, name: own.name } : null };
}
