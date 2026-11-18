// Host-authoritative 1v1 game. The player who creates the arena runs the game
// loop; the guest only sends inputs and renders snapshots. Messages travel over
// a public MQTT relay (see net.js).
import { THEMES, fetchBatch, takeQuestion, warmUp, mergeInto } from './trivia.js';
import { qKey, markSeen, seenList, isSeenHere } from './seen.js';
import { openChannel } from './net.js';
import { log } from './log.svelte.js';

export const TARGET = 10; // first to 10 wins; 10-10 => sudden death
export const QUESTION_MS = 10_000;
export const REVEAL_MS = 4_000;
export const COUNTDOWN_MS = 3_000;
export const VOTE_MS = 12_000;
export const VOTE_RESULT_MS = 3_200;
export const QUESTIONS_PER_THEME = 3;
export const ANSWER_COUNT = 3; // correct answer + 2 random wrong ones
const GRACE_MS = 700; // network grace for the guest on deadlines
const HEARTBEAT_MS = 2_000;
const PEER_TIMEOUT_MS = 12_000;
const JOIN_TIMEOUT_MS = 15_000;

export const game = $state({
  role: null, // 'host' | 'guest'
  status: 'idle', // idle | creating | waiting | connecting | connected | error | disconnected
  error: '',
  roomId: '',
  view: null, // latest snapshot from the host
  deadline: 0, // performance.now() timestamp when current phase ends
  myChoice: null,
  myVote: null,
  myRound: -1,
  myVoteKey: -1,
  rtt: null, // round-trip time to the rival in ms
  link: 'online', // relay link state: online | offline
});

const myId = (() => {
  try {
    let id = sessionStorage.getItem('certamen.id');
    if (!id) sessionStorage.setItem('certamen.id', (id = rid(10)));
    return id;
  } catch { return rid(10); }
})();

let ch = null; // relay channel
let hs = null; // host state
let guest = null; // host's view of the guest: { id, name, lastSeen }
let lastHostSeen = 0;
let timer = null;
let beat = null;
let helloTimer = null;
let session = 0; // bumps on every create/join/leave so stale async work is ignored

function rid(n) {
  const abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => abc[x % abc.length]).join('');
}
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const themeById = (id) => THEMES.find((t) => t.id === id);

// ---------- snapshots ----------
/** A question counts as seen if either player has had it before (any match). */
function isSeenByEither(key) {
  return isSeenHere(key) || !!guest?.seen?.has(key);
}

function applyView(s) {
  if (s.round !== game.myRound) { game.myRound = s.round; game.myChoice = null; }
  if (s.phase === 'question' && s.q) markSeen(qKey(s.q.text));
  if (s.voteKey !== game.myVoteKey) { game.myVoteKey = s.voteKey; game.myVote = null; }
  game.view = s;
  game.deadline = performance.now() + (s.remaining ?? 0);
}

function snapshot() {
  const revealed = hs.phase === 'reveal' || hs.phase === 'over';
  const voteDone = hs.phase === 'voteResult';
  return structuredClone({
    phase: hs.phase,
    round: hs.round,
    themeRound: hs.themeRound,
    q: hs.q,
    theme: hs.theme ? themeById(hs.theme) : null,
    names: hs.names,
    scores: hs.scores,
    answered: { host: !!hs.answers.host, guest: !!hs.answers.guest },
    answers: revealed ? hs.answers : null,
    correct: revealed ? hs.correct : null,
    voteKey: hs.voteKey,
    voteOptions: hs.voteOptions.map(themeById),
    voted: { host: !!hs.votes.host, guest: !!hs.votes.guest },
    votes: voteDone ? hs.votes : null,
    voteCoin: hs.voteCoin,
    remaining: Math.max(0, hs.phaseEnds - Date.now()),
    suddenDeath: hs.suddenDeath,
    winner: hs.winner,
    log: hs.log,
    rematch: hs.rematch,
    target: TARGET,
  });
}

function sync() {
  if (!hs) return;
  const s = snapshot();
  applyView(s);
  if (guest) ch?.send({ t: 'state', to: guest.id, s });
}

// ---------- host game loop ----------
function freshMatch(names) {
  clearTimeout(timer);
  hs = {
    names,
    phase: 'lobby',
    phaseEnds: 0,
    round: 0,
    themeRound: 0,
    q: null,
    correct: null,
    answers: { host: null, guest: null },
    scores: { host: 0, guest: 0 },
    theme: null,
    batch: [],
    usedLocal: hs?.usedLocal ?? new Set(),
    match: Symbol('match'),
    voteKey: 0,
    voteOptions: [],
    votes: { host: null, guest: null },
    voteCoin: false,
    suddenDeath: false,
    winner: null,
    log: [],
    rematch: { host: false, guest: false },
    qStart: 0,
  };
}

function setPhase(phase, showMs, next, timeoutMs = showMs) {
  clearTimeout(timer);
  hs.phase = phase;
  hs.phaseEnds = Date.now() + showMs;
  if (next) timer = setTimeout(next, timeoutMs);
  sync();
}

function startVote() {
  hs.voteKey++;
  hs.voteOptions = shuffle(THEMES.map((t) => t.id).filter((id) => id !== hs.theme)).slice(0, 6);
  hs.votes = { host: null, guest: null };
  hs.voteCoin = false;
  setPhase('vote', VOTE_MS, resolveVote, VOTE_MS + GRACE_MS);
}

function castVote(role, key, themeId) {
  if (hs?.phase !== 'vote' || key !== hs.voteKey || hs.votes[role]) return;
  if (!hs.voteOptions.includes(themeId)) return;
  hs.votes[role] = themeId;
  if (hs.votes.host && hs.votes.guest) resolveVote();
  else sync();
}

function resolveVote() {
  const { host, guest: g } = hs.votes;
  if (host && g) {
    hs.voteCoin = host !== g;
    hs.theme = hs.voteCoin ? pick([host, g]) : host;
  } else if (host || g) {
    hs.theme = host || g;
  } else {
    hs.voteCoin = true;
    hs.theme = pick(hs.voteOptions);
  }
  hs.themeRound = 0;
  hs.batch = [];
  const match = hs.match;
  log(`theme chosen: ${themeById(hs.theme)?.name}${hs.voteCoin ? ' (coin flip)' : ''} — fetching questions`);
  const theme = hs.theme;
  const sameTheme = () => hs?.match === match && hs.theme === theme;
  const ready = fetchBatch(theme, isSeenByEither, (more) => {
    if (sameTheme()) { mergeInto(hs.batch, more); log(`+${more.length} more questions arrived`); }
  }).then((b) => {
    if (!b.length) log('trivia APIs unavailable — using built-in questions');
    if (sameTheme()) mergeInto(hs.batch, b);
  });
  setPhase('voteResult', VOTE_RESULT_MS, () => ready.then(() => { if (hs?.match === match) startCountdown(); }));
}

function startCountdown() {
  hs.q = null;
  hs.answers = { host: null, guest: null };
  setPhase('countdown', COUNTDOWN_MS, startQuestion);
}

function startQuestion() {
  const q = takeQuestion(hs.batch, hs.usedLocal, hs.theme);
  const options = shuffle([q.a, ...shuffle(q.w).slice(0, ANSWER_COUNT - 1)]);
  hs.round++;
  hs.themeRound++;
  hs.q = { text: q.q, options, d: q.d, label: q.label };
  hs.correct = options.indexOf(q.a);
  hs.answers = { host: null, guest: null };
  hs.qStart = Date.now();
  setPhase('question', QUESTION_MS, reveal, QUESTION_MS + GRACE_MS);
}

function submit(role, round, choice, clientMs) {
  if (hs?.phase !== 'question' || round !== hs.round || hs.answers[role]) return;
  if (!Number.isInteger(choice) || choice < 0 || choice >= hs.q.options.length) return;
  let ms = Date.now() - hs.qStart;
  if (Number.isFinite(clientMs)) ms = Math.min(ms, Math.max(0, clientMs));
  hs.answers[role] = { choice, ms: Math.min(ms, QUESTION_MS) };
  if (hs.answers.host && hs.answers.guest) reveal();
  else sync();
}

function reveal() {
  const res = {};
  for (const r of ['host', 'guest']) {
    const a = hs.answers[r];
    res[r] = !!a && a.choice === hs.correct;
    if (res[r]) hs.scores[r]++;
  }
  hs.log.push(res);
  const { host: h, guest: g } = hs.scores;
  if (Math.max(h, g) >= TARGET) {
    if (h !== g) hs.winner = h > g ? 'host' : 'guest';
    else hs.suddenDeath = true;
  }
  setPhase('reveal', REVEAL_MS, () => {
    if (hs.winner) setPhase('over', 0);
    else if (hs.themeRound >= QUESTIONS_PER_THEME) startVote();
    else startCountdown();
  });
}

function requestRematch(role) {
  if (hs?.phase !== 'over') return;
  hs.rematch[role] = true;
  if (hs.rematch.host && hs.rematch.guest) {
    freshMatch(hs.names);
    startVote();
  } else sync();
}

// ---------- connection ----------
function stopAll() {
  session++;
  clearTimeout(timer);
  clearInterval(beat);
  clearInterval(helloTimer);
  try { ch?.close(); } catch {}
  ch = hs = guest = null;
}

function reset() {
  stopAll();
  Object.assign(game, {
    role: null, status: 'idle', error: '', roomId: '', view: null,
    myChoice: null, myVote: null, myRound: -1, myVoteKey: -1, rtt: null, link: 'online',
  });
}

function fail(type, detail = '') {
  const msgs = {
    network: 'Could not reach any relay server. Check your internet connection (or try without VPN / ad-blocker).',
    'not-found': 'No one is hosting this arena. Make sure your rival still has the arena tab open, or ask for a fresh link.',
    full: 'This arena already has two gladiators.',
  };
  log(`error: ${type} ${detail}`);
  stopAll();
  game.status = 'error';
  game.error = msgs[type] || `Something went wrong (${type}).`;
}

const cleanName = (n, fallback) => String(n || '').trim().slice(0, 18) || fallback;

function onPong(m) {
  if (Number.isFinite(m.ts)) game.rtt = Math.round(performance.now() - m.ts);
}

export async function createRoom(name) {
  reset();
  const my = session;
  const myName = cleanName(name, 'Maximus');
  game.role = 'host';
  game.status = 'creating';
  const room = rid(8);
  log(`creating arena ${room} as host "${myName}"`);
  try {
    ch = await openChannel({
      room, role: 'host', clientId: 'h-' + myId,
      onMessage: (m) => my === session && onHostMessage(m, myName),
      onStatus: (s) => (game.link = s),
    });
  } catch (e) {
    if (my === session) fail('network', e.message);
    return;
  }
  if (my !== session) { ch?.close(); return; }
  game.roomId = room;
  game.status = 'waiting';
  freshMatch({ host: myName, guest: '' });
  sync();
  log('arena ready — waiting for rival');
  warmUp(); // get the trivia API session while the rival is on the way
  beat = setInterval(() => {
    if (!guest) return;
    ch.send({ t: 'ping', to: guest.id, ts: performance.now() });
    if (Date.now() - guest.lastSeen > PEER_TIMEOUT_MS) {
      log(`rival silent for ${PEER_TIMEOUT_MS / 1000}s — treating as left`);
      guestLeft(myName);
    }
  }, HEARTBEAT_MS);
}

function guestLeft(myName) {
  guest = null;
  game.rtt = null;
  game.status = 'waiting';
  freshMatch({ host: myName, guest: '' });
  sync();
}

function onHostMessage(m, myName) {
  if (!m || typeof m !== 'object' || !m.from) return;
  if (guest && m.from !== guest.id) {
    if (m.t === 'hello') { log(`third player ${m.from} tried to join — refused`); ch.send({ t: 'full', to: m.from }); }
    return;
  }
  if (!guest && m.t !== 'hello') return;
  if (guest) guest.lastSeen = Date.now();

  switch (m.t) {
    case 'hello':
      if (guest) { log('rival re-sent hello — resyncing'); sync(); return; }
      guest = {
        id: m.from, name: cleanName(m.name, 'Rival'), lastSeen: Date.now(),
        seen: new Set(Array.isArray(m.seen) ? m.seen.filter((k) => typeof k === 'string').slice(-3000) : []),
      };
      log(`rival has seen ${guest.seen.size} questions before — those will be skipped`);
      log(`rival "${guest.name}" joined (${m.from})`);
      game.status = 'connected';
      freshMatch({ host: myName, guest: guest.name });
      startVote();
      break;
    case 'answer': submit('guest', m.round, m.choice, m.ms); break;
    case 'vote': castVote('guest', m.key, m.theme); break;
    case 'rematch': requestRematch('guest'); break;
    case 'ping': ch.send({ t: 'pong', to: m.from, ts: m.ts }); break;
    case 'pong': onPong(m); break;
    case 'bye': log('rival left the arena'); guestLeft(myName); break;
  }
}

export async function joinRoom(room, name) {
  reset();
  const my = session;
  const myName = cleanName(name, 'Rival');
  game.role = 'guest';
  game.status = 'connecting';
  game.roomId = room;
  const clientId = 'g-' + myId;
  log(`joining arena ${room} as "${myName}"`);
  try {
    ch = await openChannel({
      room, role: 'guest', clientId,
      onMessage: (m) => my === session && onGuestMessage(m, clientId),
      onStatus: (s) => (game.link = s),
    });
  } catch (e) {
    if (my === session) fail('network', e.message);
    return;
  }
  if (my !== session) { ch?.close(); return; }

  const started = Date.now();
  const hello = () => {
    if (game.status !== 'connecting') return clearInterval(helloTimer);
    if (Date.now() - started > JOIN_TIMEOUT_MS) return fail('not-found', `no answer from host in ${JOIN_TIMEOUT_MS / 1000}s`);
    log('sending hello to host…');
    ch.send({ t: 'hello', name: myName, seen: seenList(2000) });
  };
  hello();
  helloTimer = setInterval(hello, 1_500);

  lastHostSeen = Date.now();
  beat = setInterval(() => {
    if (game.status !== 'connected') return;
    ch.send({ t: 'ping', ts: performance.now() });
    if (Date.now() - lastHostSeen > PEER_TIMEOUT_MS) {
      log(`host silent for ${PEER_TIMEOUT_MS / 1000}s — connection lost`);
      stopAll();
      game.status = 'disconnected';
    }
  }, HEARTBEAT_MS);
}

function onGuestMessage(m, clientId) {
  if (!m || typeof m !== 'object') return;
  if (m.to && m.to !== clientId) {
    if (m.t === 'state' && game.status === 'connecting') {
      // The host is already playing with someone else.
      log('host is busy with another player');
    }
    return;
  }
  lastHostSeen = Date.now();
  switch (m.t) {
    case 'state':
      if (game.status !== 'connected') {
        log('connected to host — match on!');
        clearInterval(helloTimer);
        game.status = 'connected';
      }
      applyView(m.s);
      break;
    case 'full': fail('full'); break;
    case 'ping': ch.send({ t: 'pong', ts: m.ts }); break;
    case 'pong': onPong(m); break;
    case 'bye':
      log('host closed the arena');
      stopAll();
      game.status = 'disconnected';
      break;
  }
}

// ---------- player actions ----------
export function answer(choice) {
  const v = game.view;
  if (!v || v.phase !== 'question' || game.myChoice !== null) return;
  game.myChoice = choice;
  if (game.role === 'host') submit('host', v.round, choice);
  else ch?.send({ t: 'answer', round: v.round, choice, ms: QUESTION_MS - Math.max(0, game.deadline - performance.now()) });
}

export function vote(themeId) {
  const v = game.view;
  if (!v || v.phase !== 'vote' || game.myVote) return;
  game.myVote = themeId;
  if (game.role === 'host') castVote('host', v.voteKey, themeId);
  else ch?.send({ t: 'vote', key: v.voteKey, theme: themeId });
}

export function rematch() {
  if (game.role === 'host') requestRematch('host');
  else ch?.send({ t: 'rematch' });
}

export function leave() {
  log('left the arena');
  reset();
  history.replaceState(null, '', location.pathname + location.search);
}
