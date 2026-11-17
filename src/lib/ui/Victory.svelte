<script>
  import { rematch, leave } from '../game.svelte.js';
  import { sfx } from '../sound.svelte.js';
  import { roman } from '../roman.js';
  import { fade, scale } from 'svelte/transition';

  let { v, me, opp } = $props();
  const won = $derived(v.winner === me);
</script>

<div class="overlay" transition:fade={{ duration: 300 }}>
  <div class="victory tablet" class:lost={!won} in:scale={{ start: 0.85, duration: 450, delay: 150 }}>
    <div class="trophy" aria-hidden="true">{won ? '🏆' : '⚱️'}</div>
    <h2>{won ? 'Victor!' : 'Victus est'}</h2>
    <p class="champion"><b>{v.names[v.winner]}</b> is crowned champion of the arena</p>
    <div class="final">
      <span class={me}>{v.scores[me]}</span><i>–</i><span class={opp}>{v.scores[opp]}</span>
    </div>
    <p class="sub">{roman(v.scores[me])} – {roman(v.scores[opp])} after {v.round} questions</p>
    <div class="row">
      <button class="btn" onclick={() => { sfx.select(); rematch(); }} disabled={v.rematch[me]}>
        {v.rematch[me] ? 'Waiting for rival…' : v.rematch[opp] ? '⚔ Accept rematch' : '⚔ Rematch'}
      </button>
      <button class="btn ghost dark" onclick={leave}>Leave</button>
    </div>
    {#if v.rematch[opp] && !v.rematch[me]}<p class="demand">{v.names[opp]} demands a rematch!</p>{/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 16px;
    background: radial-gradient(circle, rgb(20 14 10 / 0.78), rgb(20 14 10 / 0.95));
  }
  .victory { max-width: 470px; width: 100%; padding: 1.8rem 1.5rem; text-align: center; }
  .trophy { font-size: 4.4rem; filter: drop-shadow(0 4px 14px rgb(212 175 55 / 0.65)); animation: bob 2s ease-in-out infinite; }
  h2 { font-family: var(--f-display); font-size: 2.7rem; margin: 0.2rem 0; color: var(--gold-lo); }
  .lost h2 { color: var(--crimson); }
  .champion { font-size: 1.3rem; margin: 0.2rem 0 0.8rem; }
  .final { display: flex; justify-content: center; align-items: baseline; gap: 0.8rem; font-family: var(--f-caps); font-weight: 900; font-size: 3.2rem; }
  .final .host { color: var(--crimson); }
  .final .guest { color: var(--azure); }
  .sub { color: var(--ink-soft); font-size: 1.1rem; margin: 0 0 0.8rem; }
  .row { display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap; }
  .btn.dark { color: var(--ink); border-color: var(--gold-lo); }
  .demand { color: var(--crimson); font-weight: 700; font-size: 1.15rem; margin: 0.9rem 0 0; animation: blink 1s infinite; }
  @keyframes bob { 50% { transform: translateY(-6px); } }
  @keyframes blink { 50% { opacity: 0.5; } }
</style>
