// Host-authoritative 1v1 game over WebRTC (PeerJS). The player who creates the
// arena runs the game loop; the guest only sends inputs and renders snapshots.
import Peer from 'peerjs';
import { THEMES, fetchBatch, takeQuestion } from './trivia.js';

export const TARGET = 10; // first to 10 wins; 10-10 => sudden death
export const QUESTION_MS = 10_000;
export const REVEAL_MS = 4_500;
export const VOTE_MS = 12_000;
export const VOTE_RESULT_MS = 3_200;
export const QUESTIONS_PER_THEME = 3;
const GRACE_MS = 300; // network grace for the guest on the question deadline
const PREFIX = 'certamen-romanum-v1-';

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
});

let peer = null;
let conn = null;
let hs = null; // host state
let timer = null;
let joinTimer = null;

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
function applyView(s) {
  if (s.round !== game.myRound) { game.myRound = s.round; game.myChoice = null; }
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
  if (conn?.open) conn.send({ t: 'state', s });
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
    batchReady: null,
    usedLocal: new Set(),
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
  const { host, guest } = hs.votes;
  if (host && guest) {
    hs.voteCoin = host !== guest;
    hs.theme = hs.voteCoin ? pick([host, guest]) : host;
  } else if (host || guest) {
    hs.theme = host || guest;
  } else {
    hs.voteCoin = true;
    hs.theme = pick(hs.voteOptions);
  }
  hs.themeRound = 0;
  hs.batch = [];
  const match = hs.match;
  const ready = fetchBatch(hs.theme).then((b) => { if (hs?.match === match) hs.batch = b; });
  setPhase('voteResult', VOTE_RESULT_MS, () => ready.then(() => { if (hs?.match === match) startQuestion(); }));
}

function startQuestion() {
  const q = takeQuestion(hs.batch, hs.usedLocal);
  const options = shuffle([q.a, ...q.w]);
  hs.round++;
  hs.themeRound++;
  hs.q = { text: q.q, options, d: q.d };
  hs.correct = options.indexOf(q.a);
  hs.answers = { host: null, guest: null };
  hs.qStart = Date.now();
  setPhase('question', QUESTION_MS, reveal, QUESTION_MS + GRACE_MS);
}

function submit(role, round, choice, clientMs) {
  if (hs?.phase !== 'question' || round !== hs.round || hs.answers[role]) return;
  if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
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
    else startQuestion();
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
function cleanup() {
  clearTimeout(timer);
  clearTimeout(joinTimer);
  try { conn?.close(); } catch {}
  try { peer?.destroy(); } catch {}
  peer = conn = hs = null;
  Object.assign(game, {
    role: null, status: 'idle', error: '', roomId: '', view: null,
    myChoice: null, myVote: null, myRound: -1, myVoteKey: -1,
  });
}

function fail(err) {
  const msgs = {
    'peer-unavailable': 'That arena does not exist (any more). Ask your rival for a fresh link.',
    'unavailable-id': 'Arena name collision — please try again.',
    network: 'Could not reach the signalling server. Check your connection.',
    'browser-incompatible': 'This browser does not support WebRTC.',
    full: 'This arena already has two gladiators.',
    timeout: 'Could not reach your rival. Ask them to keep their arena tab open and try again.',
  };
  clearTimeout(timer);
  clearTimeout(joinTimer);
  game.status = 'error';
  game.error = msgs[err?.type] || `Something went wrong (${err?.type || err?.message || 'unknown'}).`;
}

const cleanName = (n, fallback) => String(n || '').trim().slice(0, 18) || fallback;

export function createRoom(name) {
  cleanup();
  game.role = 'host';
  game.status = 'creating';
  const id = Math.random().toString(36).slice(2, 8);
  const myName = cleanName(name, 'Maximus');
  peer = new Peer(PREFIX + id);
  peer.on('open', () => {
    game.roomId = id;
    game.status = 'waiting';
    freshMatch({ host: myName, guest: '' });
    sync();
  });
  peer.on('connection', (c) => {
    if (conn?.open) {
      c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); });
      return;
    }
    conn = c;
    c.on('data', (d) => {
      if (c !== conn || !d || typeof d !== 'object') return;
      if (d.t === 'hello') {
        freshMatch({ host: myName, guest: cleanName(d.name, 'Rival') });
        game.status = 'connected';
        startVote();
      } else if (d.t === 'answer') submit('guest', d.round, d.choice, d.ms);
      else if (d.t === 'vote') castVote('guest', d.key, d.theme);
      else if (d.t === 'rematch') requestRematch('guest');
    });
    c.on('close', () => {
      if (c !== conn) return;
      conn = null;
      game.status = 'waiting';
      freshMatch({ host: myName, guest: '' });
      sync();
    });
  });
  peer.on('disconnected', () => { try { peer?.reconnect(); } catch {} });
  peer.on('error', (e) => { if (e.type !== 'peer-unavailable') fail(e); });
}

export function joinRoom(id, name) {
  cleanup();
  game.role = 'guest';
  game.status = 'connecting';
  game.roomId = id;
  peer = new Peer();
  joinTimer = setTimeout(() => game.status === 'connecting' && fail({ type: 'timeout' }), 20_000);
  peer.on('open', () => {
    conn = peer.connect(PREFIX + id, { reliable: true, serialization: 'json' });
    conn.on('open', () => conn.send({ t: 'hello', name: cleanName(name, 'Rival') }));
    conn.on('data', (d) => {
      if (d?.t === 'state') {
        clearTimeout(joinTimer);
        game.status = 'connected';
        applyView(d.s);
      } else if (d?.t === 'full') fail({ type: 'full' });
    });
    conn.on('close', () => { if (game.status !== 'error') game.status = 'disconnected'; });
  });
  peer.on('error', fail);
}

// ---------- player actions ----------
export function answer(choice) {
  const v = game.view;
  if (!v || v.phase !== 'question' || game.myChoice !== null) return;
  game.myChoice = choice;
  if (game.role === 'host') submit('host', v.round, choice);
  else conn?.send({ t: 'answer', round: v.round, choice, ms: QUESTION_MS - Math.max(0, game.deadline - performance.now()) });
}

export function vote(themeId) {
  const v = game.view;
  if (!v || v.phase !== 'vote' || game.myVote) return;
  game.myVote = themeId;
  if (game.role === 'host') castVote('host', v.voteKey, themeId);
  else conn?.send({ t: 'vote', key: v.voteKey, theme: themeId });
}

export function rematch() {
  if (game.role === 'host') requestRematch('host');
  else conn?.send({ t: 'rematch' });
}

export function leave() {
  cleanup();
  history.replaceState(null, '', location.pathname + location.search);
}
