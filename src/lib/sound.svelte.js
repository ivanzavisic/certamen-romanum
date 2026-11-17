// Tiny Web Audio synth: every effect is generated, so there are no audio files.
const KEY = 'certamen.muted';

export const sound = $state({ muted: load() });

function load() { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } }

export function toggleMute() {
  sound.muted = !sound.muted;
  try { localStorage.setItem(KEY, sound.muted ? '1' : '0'); } catch {}
  if (!sound.muted) unlock();
}

let ctx = null;
let master = null;

/** Browsers only allow audio after a user gesture — call this from click handlers. */
export function unlock() {
  try {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio */ }
}

function tone(freq, at, dur, { type = 'sine', vol = 0.25, slide = 0, attack = 0.008 } = {}) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function thud(at, dur = 0.35, vol = 0.5, freq = 140) {
  const t = ctx.currentTime + at;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ctx.createBufferSource();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  src.buffer = buf;
  f.type = 'lowpass';
  f.frequency.value = freq * 6;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
  tone(freq, at, dur, { type: 'sine', vol: vol * 0.8, slide: freq * 0.5 });
}

const play = (fn) => () => {
  if (sound.muted || !ctx || ctx.state !== 'running') return;
  try { fn(); } catch { /* ignore */ }
};

export const sfx = {
  /** III · II · I */
  count: play(() => { thud(0, 0.25, 0.35, 110); tone(392, 0, 0.22, { type: 'triangle', vol: 0.22 }); }),
  /** question appears */
  go: play(() => {
    tone(523, 0, 0.12, { type: 'triangle', vol: 0.22 });
    tone(784, 0.09, 0.32, { type: 'triangle', vol: 0.26 });
    tone(1568, 0.09, 0.25, { type: 'sine', vol: 0.06 });
  }),
  /** last three seconds */
  tick: play(() => tone(1320, 0, 0.06, { type: 'square', vol: 0.06 })),
  /** I locked in an answer / vote */
  select: play(() => { tone(660, 0, 0.06, { type: 'triangle', vol: 0.2 }); tone(990, 0.05, 0.09, { type: 'triangle', vol: 0.16 }); }),
  /** rival locked in */
  rival: play(() => tone(330, 0, 0.12, { type: 'sine', vol: 0.12, slide: 440 })),
  correct: play(() => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.075, 0.4, { type: 'triangle', vol: 0.24 }));
    [2093, 2637].forEach((f, i) => tone(f, 0.3 + i * 0.06, 0.35, { type: 'sine', vol: 0.05 }));
  }),
  wrong: play(() => {
    tone(196, 0, 0.5, { type: 'sawtooth', vol: 0.14, slide: 98 });
    tone(207, 0, 0.5, { type: 'sawtooth', vol: 0.1, slide: 103 });
    thud(0, 0.3, 0.3, 90);
  }),
  timeout: play(() => { thud(0, 0.4, 0.35, 70); tone(294, 0.05, 0.45, { type: 'triangle', vol: 0.12, slide: 147 }); }),
  horn: play(() => {
    tone(262, 0, 0.5, { type: 'sawtooth', vol: 0.07 });
    tone(392, 0.12, 0.6, { type: 'sawtooth', vol: 0.07 });
    tone(392, 0.12, 0.6, { type: 'triangle', vol: 0.14 });
  }),
  coin: play(() => { for (let i = 0; i < 9; i++) tone(1400 + (i % 2) * 300, i * 0.07, 0.05, { type: 'sine', vol: 0.09 }); thud(0.7, 0.2, 0.2, 200); }),
  drum: play(() => { thud(0, 0.3, 0.45); thud(0.18, 0.3, 0.45); }),
  victory: play(() => {
    const n = [[523, 0, 0.16], [523, 0.17, 0.16], [523, 0.34, 0.16], [659, 0.51, 0.45], [587, 0.98, 0.16], [659, 1.15, 0.16], [784, 1.32, 0.9]];
    n.forEach(([f, t, d]) => { tone(f, t, d, { type: 'sawtooth', vol: 0.06 }); tone(f, t, d, { type: 'triangle', vol: 0.2 }); });
    thud(1.32, 0.6, 0.4, 100);
  }),
  defeat: play(() => {
    [392, 370, 349, 294].forEach((f, i) => tone(f, i * 0.32, 0.5, { type: 'triangle', vol: 0.18 }));
    thud(1.0, 0.6, 0.3, 60);
  }),
};
