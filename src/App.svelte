<script>
  import { game } from './lib/game.svelte.js';
  import Lobby from './lib/ui/Lobby.svelte';
  import Arena from './lib/ui/Arena.svelte';
  import SoundToggle from './lib/ui/SoundToggle.svelte';

  const inGame = $derived(game.status === 'connected' && game.view && game.view.phase !== 'lobby');
</script>

<div class="columns" aria-hidden="true"><span></span><span></span></div>

<SoundToggle />

{#if inGame}
  <Arena />
{:else}
  <Lobby />
{/if}

<footer>Quaestiones ex <a href="https://the-trivia-api.com" target="_blank" rel="noreferrer">The Trivia API</a> &amp; <a href="https://opentdb.com" target="_blank" rel="noreferrer">Open Trivia DB</a> (CC BY-SA 4.0)</footer>

<style>
  .columns span {
    position: fixed;
    top: 0;
    bottom: 0;
    width: 64px;
    pointer-events: none;
    opacity: 0.12;
    background:
      repeating-linear-gradient(90deg, #fff7e0 0 6px, #8c7a5c 6px 8px, #fff7e0 8px 14px);
    mask-image: linear-gradient(180deg, transparent, #000 15%, #000 85%, transparent);
  }
  .columns span:first-child { left: 18px; }
  .columns span:last-child { right: 18px; }
  @media (max-width: 900px) { .columns { display: none; } }

  footer {
    text-align: center;
    font-size: 0.8rem;
    opacity: 0.45;
    padding: 1.5rem 1rem 1rem;
  }
  footer a { color: inherit; }
</style>
