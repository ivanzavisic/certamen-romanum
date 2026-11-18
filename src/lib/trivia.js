// Question sources:
//  - The Trivia API (https://the-trivia-api.com) — ~15,000 questions, tagged by topic.
//  - Open Trivia DB (https://opentdb.com, CC BY-SA 4.0) — ~4,000 questions in 24 categories.
// Both are queried for a theme when they cover it, merged and de-duplicated.
// Questions either player has already seen (in any earlier match) are skipped.
// The built-in bank in questions.js is only a last-resort fallback.
import { QUESTIONS as LOCAL, THEMES as LOCAL_THEMES } from './questions.js';
import { log } from './log.svelte.js';
import { qKey } from './seen.js';

/**
 * otdb:   Open Trivia DB category id
 * tta:    The Trivia API query (categories=… or tags=a,b — tags are OR-ed)
 * backup: built-in bank themes that fit (null = any)
 */
const T = (id, name, latin, icon, { otdb = null, tta = null, backup = [] } = {}) => ({ id, name, latin, icon, otdb, tta, backup });

export const THEMES = [
  // --- broad ---
  T('general', 'General Knowledge', 'Scientia', '📜', { otdb: 9, tta: 'categories=general_knowledge', backup: null }),
  T('geo', 'Geography', 'Geographia', '🗺️', { otdb: 22, tta: 'categories=geography', backup: ['geo'] }),
  T('history', 'History', 'Historia', '🏛️', { otdb: 23, tta: 'categories=history', backup: ['history', 'rome'] }),
  T('science', 'Science & Nature', 'Natura', '🌿', { otdb: 17, tta: 'categories=science', backup: ['science', 'space'] }),
  T('sports', 'Sports & Leisure', 'Certamina', '🏆', { otdb: 21, tta: 'categories=sport_and_leisure', backup: ['sport'] }),
  T('music', 'Music', 'Musica', '🎵', { otdb: 12, tta: 'categories=music', backup: ['music'] }),
  T('food', 'Food & Drink', 'Cibus et Potus', '🍷', { tta: 'categories=food_and_drink', backup: ['food'] }),
  T('society', 'Society & Culture', 'Mores', '🏙️', { tta: 'categories=society_and_culture' }),
  // --- history & places ---
  T('ancient', 'Ancient World', 'Antiquitas', '🏺', { tta: 'tags=era:ancient-world,era:ancient-rome,era:ancient-greece,era:ancient-egypt', backup: ['rome', 'myth'] }),
  T('20c', '20th Century', 'Saeculum XX', '📻', { tta: 'tags=era:20th-century' }),
  T('ww2', 'World Wars & Military', 'Bellum', '⚔️', { tta: 'tags=event:world-war-ii,topic:military' }),
  T('royals', 'Politics & Monarchs', 'Res Publica', '👑', { tta: 'tags=topic:politics,person:monarchs' }),
  T('europe', 'Europe', 'Europa', '🇪🇺', { tta: 'tags=place:europe', backup: ['geo', 'alpadria'] }),
  T('asia', 'Asia & Africa', 'Asia et Africa', '🌏', { tta: 'tags=place:asia,place:africa' }),
  T('flags', 'Flags & Capitals', 'Vexilla', '🚩', { tta: 'tags=topic:flags,place:capital-cities,topic:national-symbols' }),
  T('nature', 'Rivers, Seas & Mountains', 'Terra', '🏔️', { tta: 'tags=place:rivers,place:oceans-and-seas,place:mountains,place:islands,science:earth-science' }),
  // --- science ---
  T('body', 'Human Body & Medicine', 'Corpus', '🫀', { tta: 'tags=science:human-body,science:medicine,science:diseases,science:organs-and-systems' }),
  T('chem', 'Chemistry & Physics', 'Physica', '⚗️', { tta: 'tags=science:chemistry,science:physics,science:chemical-compounds' }),
  T('space', 'Space & Astronomy', 'Astra', '🔭', { tta: 'tags=science:astronomy', backup: ['space'] }),
  T('animals', 'Animals', 'Animalia', '🦁', { otdb: 27, tta: 'tags=animal:animals,animal:mammals,animal:birds,topic:animal-terminology' }),
  T('plants', 'Plants & Biology', 'Botanica', '🌱', { tta: 'tags=science:botany,science:biology,food:fruit' }),
  T('computers', 'Computers & Tech', 'Machinae', '💻', { otdb: 18, tta: 'tags=science:computing,science:technology' }),
  T('maths', 'Mathematics', 'Mathematica', '📐', { otdb: 19, tta: 'tags=science:mathematics' }),
  T('ologies', 'Ologies & Phobias', 'Logia', '🧪', { tta: 'tags=topic:ologies-and-phobias' }),
  // --- culture ---
  T('myth', 'Mythology & Religion', 'Mythologia', '⚡', { otdb: 20, tta: 'tags=topic:mythology,topic:greek-mythology,topic:mythical-creatures,topic:religion', backup: ['myth'] }),
  T('philosophy', 'Philosophy & Quotes', 'Sapientia', '🦉', { tta: 'tags=topic:philosophy,topic:famous-quotes' }),
  T('words', 'Words & Language', 'Lingua', '🔤', { tta: 'tags=topic:language,topic:words,topic:etymology,topic:abbreviations-and-acronyms,topic:translations' }),
  T('books', 'Books & Authors', 'Libri', '📚', { otdb: 10, tta: 'tags=topic:literature,person:authors,topic:classic-literature', backup: ['arts'] }),
  T('fantasy', 'Fantasy & Sci-Fi', 'Fabulae', '🐉', { tta: 'tags=topic:fantasy,topic:science-fiction,topic:horror' }),
  T('art', 'Art & Painting', 'Ars', '🎨', { tta: 'tags=topic:art,topic:painting,person:artists,topic:art-movements', backup: ['arts'] }),
  T('theatre', 'Musicals & Theatre', 'Scaena', '🎭', { otdb: 13, tta: 'tags=topic:theatre', backup: ['music', 'arts'] }),
  T('traditions', 'Customs & Festivals', 'Feriae', '🎉', { tta: 'tags=topic:customs-and-traditions,event:holidays-and-festivals,topic:famous-firsts' }),
  // --- screen & music ---
  T('film', 'Film', 'Theatrum Lucis', '🎬', { otdb: 11, tta: 'tags=topic:film,topic:film-plots,topic:film-quotes', backup: ['screen'] }),
  T('hollywood', 'Hollywood & Oscars', 'Stellae', '🌟', { tta: 'tags=topic:classic-hollywood,event:academy-awards,person:actors' }),
  T('tv', 'Television', 'Televisio', '📺', { otdb: 14, tta: 'tags=topic:television', backup: ['screen'] }),
  T('heroes', 'Superheroes & Comics', 'Heroes', '🦸', { otdb: 29, tta: 'tags=topic:superheroes,work:marvel,work:marvel-cinematic-universe' }),
  T('rockpop', 'Rock & Pop', 'Carmina', '🎸', { tta: 'tags=music:rock,music:pop,music:charts,music:heavy-metal,music:indie-and-alternative', backup: ['music'] }),
  T('musicians', 'Musicians & Albums', 'Citharoedi', '🎤', { tta: 'tags=music:musicians,music:albums,music:song-lyrics', backup: ['music'] }),
  T('anime', 'Anime & Manga', 'Pictura Iaponica', '🌸', { otdb: 31 }),
  T('cartoons', 'Cartoons', 'Imagines Motae', '🐭', { otdb: 32 }),
  // --- games, sport & everyday ---
  T('videogames', 'Video Games', 'Ludi Electrici', '🎮', { otdb: 15, tta: 'tags=topic:video-games' }),
  T('boardgames', 'Board Games', 'Ludi Tabulae', '🎲', { otdb: 16, tta: 'tags=topic:board-games' }),
  T('football', 'Football & Athletes', 'Pila', '⚽', { tta: 'tags=sport:football-soccer,person:sportspeople,sport:sports-rules-and-terms', backup: ['sport'] }),
  T('vehicles', 'Cars & Transport', 'Vehicula', '🛞', { otdb: 28, tta: 'tags=topic:cars-and-motoring,topic:transport' }),
  T('business', 'Business & Brands', 'Mercatura', '💼', { tta: 'tags=topic:business,org:companies,org:brands' }),
  T('drinks', 'Drinks & Cuisine', 'Convivium', '🍸', { tta: 'tags=food:drinks,food:alcoholic-drinks,food:spirits,food:world-cuisine', backup: ['food'] }),
];

const themeOf = (id) => THEMES.find((t) => t.id === id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dec = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

// ---------------- Open Trivia DB ----------------
const OTDB = 'https://opentdb.com';
const GAP_MS = 5_200; // one request per 5 s per IP
const MAX_ATTEMPTS = 4;
let token = null;
let last = 0;

async function otdbCall(path) {
  const wait = last + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  last = Date.now();
  const res = await fetch(OTDB + path, { signal: AbortSignal.timeout(8_000) });
  if (res.status === 429) return { response_code: 5 };
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

/** Get an Open Trivia DB session early (while waiting for the rival). */
export async function warmUp() {
  if (token) return;
  try {
    token = (await otdbCall('/api_token.php?command=request')).token || null;
    if (token) log('Open Trivia DB session ready');
  } catch (e) {
    log(`Open Trivia DB token failed (${e.message})`);
  }
}

async function fetchOtdb(category) {
  if (!token) await warmUp();
  let amount = 20;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const tk = token ? `&token=${token}` : '';
      const j = await otdbCall(`/api.php?amount=${amount}&category=${category}&type=multiple&encode=url3986${tk}`);
      switch (j.response_code) {
        case 0:
          return j.results.map((r) => ({
            q: dec(r.question), a: dec(r.correct_answer), w: r.incorrect_answers.map(dec), level: r.difficulty,
          }));
        case 1:
          if (amount > 5) { amount = amount > 10 ? 10 : 5; break; }
          if (token) await otdbCall(`/api_token.php?command=reset&token=${token}`);
          amount = 20;
          break;
        case 3: token = null; break;
        case 4: await otdbCall(`/api_token.php?command=reset&token=${token}`); break;
        case 5: log(`Open Trivia DB busy (attempt ${attempt})`); break;
        default: return [];
      }
    } catch (e) {
      log(`Open Trivia DB error (attempt ${attempt}): ${e.message}`);
    }
  }
  return [];
}

// ---------------- The Trivia API ----------------
async function fetchTta(query) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`https://the-trivia-api.com/v2/questions?limit=20&${query}`, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      return j.map((r) => ({ q: r.question?.text, a: r.correctAnswer, w: r.incorrectAnswers || [], level: r.difficulty }));
    } catch (e) {
      log(`The Trivia API error (attempt ${attempt}): ${e.message}`);
      await sleep(800);
    }
  }
  return [];
}

// ---------------- batches ----------------
const MAX_ANSWER = 70; // some API answers are whole sentences; skip those

function tidy(list, isSeen) {
  const out = [];
  for (const q of list) {
    if (!q.q || !q.a || q.w.length < 2) continue;
    if ([q.a, ...q.w].some((s) => String(s).length > MAX_ANSWER)) continue;
    q.key = qKey(q.q);
    q.stale = isSeen(q.key);
    out.push(q);
  }
  return out;
}

export function mergeInto(batch, more) {
  const keys = new Set(batch.map((q) => q.key));
  for (const q of more) if (!keys.has(q.key)) { keys.add(q.key); batch.push(q); }
  return batch;
}

/**
 * Fetch questions for a theme from every source that covers it. Resolves as
 * soon as there are enough unseen questions; slower sources arrive via onLate.
 * Never throws.
 */
export async function fetchBatch(themeId, isSeen, onLate) {
  const t = themeOf(themeId);
  if (!t) return [];
  const otdbP = t.otdb ? fetchOtdb(t.otdb).then((l) => tidy(l, isSeen)) : Promise.resolve([]);
  let batch = [];
  if (t.tta) {
    // This API leans hard, so ask for easy questions separately to keep the mix
    // close to the difficulty weights below.
    const [easy, rest] = await Promise.all([
      fetchTta(`${t.tta}&difficulties=easy`),
      fetchTta(`${t.tta}&difficulties=medium,hard`),
    ]);
    mergeInto(batch, tidy([...easy, ...rest], isSeen));
    if (batch.filter((q) => !q.stale).length < 8) mergeInto(batch, tidy(await fetchTta(t.tta), isSeen));
  }
  const fresh = () => batch.filter((q) => !q.stale).length;
  if (fresh() < 3) {
    mergeInto(batch, await otdbP);
  } else if (t.otdb) {
    otdbP.then((more) => more.length && onLate?.(more));
  }
  log(`${t.name}: ${fresh()} new questions ready${batch.length - fresh() ? ` (+${batch.length - fresh()} already seen, kept as reserve)` : ''}`);
  return batch;
}

// ---------------- difficulty ----------------
/**
 * Difficulty 4..10 (nothing is rated 1-3), weighted towards the easy end with a
 * thin top tail so 9s and 10s are rare treats. Weights are percentages.
 */
const DIFFICULTY_WEIGHTS = { 4: 30, 5: 27, 6: 21, 7: 12, 8: 7, 9: 2, 10: 1 };

export function rollDifficulty() {
  let r = Math.random() * 100;
  for (const [d, w] of Object.entries(DIFFICULTY_WEIGHTS)) {
    if ((r -= w) < 0) return Number(d);
  }
  return 6;
}

const levelOf = (d) => (d <= 5 ? 'easy' : d <= 8 ? 'medium' : 'hard');
const NEAREST = { easy: ['easy', 'medium', 'hard'], medium: ['medium', 'easy', 'hard'], hard: ['hard', 'medium', 'easy'] };
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

function pickNear(pool, d) {
  const best = Math.min(...pool.map((q) => Math.abs(q.d - d)));
  return pickRandom(pool.filter((q) => Math.abs(q.d - d) === best));
}

/**
 * Take one question for the rolled difficulty: unseen API questions first, then
 * already-seen ones, then the built-in bank (on-theme where it can be).
 * Returns `label` (a theme to display) only when the question is off-theme.
 */
export function takeQuestion(batch, usedLocal, themeId) {
  const d = rollDifficulty();
  for (const stale of [false, true]) {
    for (const level of NEAREST[levelOf(d)]) {
      const options = batch.filter((q) => q.level === level && !!q.stale === stale);
      if (options.length) {
        const q = pickRandom(options);
        batch.splice(batch.indexOf(q), 1);
        if (stale) log('no unseen questions left in this theme — reusing one');
        return { ...q, d: levelOf(d) === level ? d : { easy: 5, medium: 7, hard: 9 }[level], label: null };
      }
    }
  }

  const fits = themeOf(themeId)?.backup;
  const onTheme = (q) => fits === null || fits.includes(q.t);
  let pool = LOCAL.filter((q) => onTheme(q) && !usedLocal.has(q));
  if (!pool.length) {
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
  log(`backup question used${offTheme ? ` (shown as ${own?.name})` : ''}`);
  return { q: q.q, a: q.a, w: q.w, d: q.d, key: qKey(q.q), label: offTheme && own ? { icon: own.icon, name: own.name } : null };
}
