// Tiny Web Audio synth: every effect is generated, so there are no audio files.
// Kept deliberately soft: only sine/triangle waves, gentle attacks, a low master
// volume and a low-pass filter that takes the edge off. No per-second ticking.
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
      const soften = ctx.createBiquadFilter();
      soften.type = 'lowpass';
      soften.frequency.value = 2800;
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(soften).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* no audio */ }
}

function tone(freq, at, dur, { type = 'sine', vol = 0.1, slide = 0, attack = 0.02 } = {}) {
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

const play = (fn) => () => {
  if (sound.muted || !ctx || ctx.state !== 'running') return;
  try { fn(); } catch { /* ignore */ }
};

const quiet = () => {};

export const sfx = {
  /** III · II · I — a soft low pulse */
  count: play(() => tone(392, 0, 0.18, { vol: 0.09 })),
  /** question appears — gentle rising two-note chime */
  go: play(() => { tone(587, 0, 0.18, { vol: 0.08 }); tone(784, 0.1, 0.3, { vol: 0.09 }); }),
  /** last-seconds ticking was the most annoying part — removed on purpose */
  tick: quiet,
  /** I locked in an answer / vote — a tiny click */
  select: play(() => tone(880, 0, 0.07, { vol: 0.05, attack: 0.005 })),
  /** rival locked in — barely there */
  rival: play(() => tone(523, 0, 0.12, { vol: 0.035 })),
  /** right answer — short major arpeggio */
  correct: play(() => {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.08, 0.32, { type: 'triangle', vol: 0.1 }));
  }),
  /** wrong answer — soft falling two notes, no buzz */
  wrong: play(() => { tone(330, 0, 0.22, { vol: 0.09 }); tone(262, 0.16, 0.34, { vol: 0.08 }); }),
  /** no answer in time */
  timeout: play(() => tone(247, 0, 0.4, { vol: 0.07, slide: 196 })),
  /** theme vote opens */
  horn: play(() => { tone(523, 0, 0.3, { vol: 0.06 }); tone(784, 0.12, 0.4, { vol: 0.06 }); }),
  /** split vote, Fortuna flips the coin */
  coin: play(() => { [1175, 1397, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.08, { vol: 0.03 })); }),
  /** both voted the same theme */
  drum: play(() => tone(294, 0, 0.3, { type: 'triangle', vol: 0.08 })),
  victory: play(() => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.45, { type: 'triangle', vol: 0.1 }));
    tone(784, 0.55, 0.9, { vol: 0.06 });
    tone(1047, 0.55, 0.9, { vol: 0.05 });
  }),
  defeat: play(() => { [392, 349, 311].forEach((f, i) => tone(f, i * 0.28, 0.45, { vol: 0.07 })); }),
};
