// Questions come from Open Trivia DB (https://opentdb.com, CC BY-SA 4.0).
// The local bank in questions.js is only used as a fallback if the API fails.
import { QUESTIONS as LOCAL } from './questions.js';

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

const API = 'https://opentdb.com';
const GAP_MS = 5_200; // API allows one request per 5 s per IP
let token = null;
let last = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function call(path) {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(API + path, { signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

/** Fetch a batch of multiple-choice questions for one category. Never throws. */
export async function fetchBatch(category) {
  try {
    if (!token) token = (await call('/api_token.php?command=request')).token || null;
  } catch { /* play without token */ }
  for (const amount of [12, 6]) {
    try {
      const tk = token ? `&token=${token}` : '';
      const j = await call(`/api.php?amount=${amount}&category=${category}&type=multiple&encode=url3986${tk}`);
      if (j.response_code === 0) {
        return j.results.map((r) => ({
          q: dec(r.question),
          a: dec(r.correct_answer),
          w: r.incorrect_answers.map(dec),
          level: r.difficulty,
        }));
      }
      if (j.response_code === 4 && token) await call(`/api_token.php?command=reset&token=${token}`);
      else if (j.response_code === 3) token = null;
    } catch {
      break;
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

/** Take one question out of the batch matching a rolled difficulty; falls back to the local bank. */
export function takeQuestion(batch, usedLocal) {
  const d = rollDifficulty();
  for (const level of NEAREST[levelOf(d)]) {
    const i = batch.findIndex((q) => q.level === level);
    if (i >= 0) {
      const [q] = batch.splice(i, 1);
      // Keep the shown rating consistent with the API's own level.
      return { ...q, d: levelOf(d) === level ? d : { easy: 5, medium: 7, hard: 9 }[level] };
    }
  }
  let pool = LOCAL.filter((q) => !usedLocal.has(q));
  if (!pool.length) { usedLocal.clear(); pool = LOCAL; }
  const best = Math.min(...pool.map((q) => Math.abs(q.d - d)));
  const near = pool.filter((q) => Math.abs(q.d - d) === best);
  const q = near[Math.floor(Math.random() * near.length)];
  usedLocal.add(q);
  return { q: q.q, a: q.a, w: q.w, d: q.d };
}
