<script>
  import { game, vote } from '../game.svelte.js';
  import { sfx } from '../sound.svelte.js';

  let { v } = $props();

  function choose(id) {
    if (game.myVote) return;
    sfx.select();
    vote(id);
  }
</script>

<section>
  <h2 class="caps">Choose the next battlefield</h2>
  <p class="sub">The next 3 questions come from this theme. If your votes differ, Fortuna flips a coin.</p>
  <div class="themes">
    {#each v.voteOptions as t, i (t.id)}
      <button class="theme tablet" style:--i={i}
        class:picked={game.myVote === t.id}
        class:dim={game.myVote && game.myVote !== t.id}
        disabled={!!game.myVote}
        onclick={() => choose(t.id)}>
        <span class="icon">{t.icon}</span>
        <span class="tname">{t.name}</span>
        <span class="latin">{t.latin}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  h2 { text-align: center; color: var(--gold-hi); margin: 0.4rem 0 0.3rem; font-size: 1.5rem; }
  .sub { text-align: center; color: var(--text-muted); margin: 0 0 1.2rem; font-size: 1.15rem; }
  .themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
  .theme {
    display: flex; flex-direction: column; align-items: center; gap: 0.3rem;
    padding: 1.2rem 0.6rem;
    transition: transform 0.18s, opacity 0.25s, box-shadow 0.25s, filter 0.25s;
    animation: deal 0.4s ease-out backwards;
    animation-delay: calc(var(--i) * 60ms);
  }
  .theme:hover:not(:disabled) { transform: translateY(-4px); }
  .theme.picked { box-shadow: 0 0 0 4px var(--gold-hi), 0 0 34px rgb(212 175 55 / 0.65); transform: scale(1.04); }
  .theme.dim { opacity: 0.45; filter: grayscale(0.6); }
  .icon { font-size: 2.3rem; }
  .tname { font-family: var(--f-caps); font-weight: 700; font-size: 1.1rem; color: var(--ink); }
  .latin { font-style: italic; color: var(--ink-soft); font-size: 1.05rem; }
  @keyframes deal { from { opacity: 0; transform: translateY(14px) scale(0.96); } }
  @media (max-width: 640px) {
    .themes { grid-template-columns: repeat(2, 1fr); gap: 0.7rem; }
    .tname { font-size: 0.95rem; }
  }
</style>
