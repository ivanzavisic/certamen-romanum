<script>
  import { fly } from 'svelte/transition';
  import { game, QUESTION_MS, VOTE_MS, COUNTDOWN_MS } from '../game.svelte.js';
  import { sfx } from '../sound.svelte.js';
  import Hud from './Hud.svelte';
  import ThemeVote from './ThemeVote.svelte';
  import VoteResult from './VoteResult.svelte';
  import Countdown from './Countdown.svelte';
  import QuestionStage from './QuestionStage.svelte';
  import Victory from './Victory.svelte';

  // Smooth clock for timers.
  let now = $state(performance.now());
  $effect(() => {
    let raf;
    const tick = () => { now = performance.now(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  const v = $derived(game.view);
  const me = $derived(game.role);
  const opp = $derived(me === 'host' ? 'guest' : 'host');
  const remaining = $derived(Math.max(0, game.deadline - now));
  const phaseMs = $derived({ vote: VOTE_MS, question: QUESTION_MS, countdown: COUNTDOWN_MS }[v.phase] ?? 1);
  const secs = $derived(Math.ceil(remaining / 1000));

  // One key per "screen", so each new screen animates in exactly once.
  const stageKey = $derived(
    v.phase === 'vote' ? `vote${v.voteKey}`
    : v.phase === 'voteResult' ? `vr${v.voteKey}`
    : v.phase === 'countdown' ? `cd${v.round}`
    : `q${v.round}`,
  );

  // ---- sound director: react to state changes, not to clicks ----
  let lastPhaseKey = '';
  $effect(() => {
    const key = `${v.phase}|${v.round}|${v.voteKey}`;
    if (key === lastPhaseKey) return;
    lastPhaseKey = key;
    switch (v.phase) {
      case 'vote': sfx.horn(); break;
      case 'voteResult': v.voteCoin ? sfx.coin() : sfx.drum(); break;
      case 'question': sfx.go(); break;
      case 'reveal': {
        const a = v.answers?.[me];
        if (!a) sfx.timeout();
        else if (a.choice === v.correct) sfx.correct();
        else sfx.wrong();
        break;
      }
      case 'over': setTimeout(() => (v.winner === me ? sfx.victory() : sfx.defeat()), 300); break;
    }
  });

  let lastSec = -1;
  $effect(() => {
    const s = secs;
    if (s === lastSec) return;
    lastSec = s;
    if (v.phase === 'countdown' && s > 0) sfx.count();
    else if (v.phase === 'question' && s > 0 && s <= 3) sfx.tick();
  });

  let rivalWas = false;
  $effect(() => {
    const answered = v.phase === 'question' && v.answered[opp];
    if (answered && !rivalWas) sfx.rival();
    rivalWas = answered;
  });
</script>

<main class:sudden={v.suddenDeath && !v.winner}>
  <Hud {v} {me} {opp} {remaining} {phaseMs} />

  <div class="stage">
    {#key stageKey}
      <div in:fly={{ y: 18, duration: 320 }}>
        {#if v.phase === 'vote'}
          <ThemeVote {v} />
        {:else if v.phase === 'voteResult'}
          <VoteResult {v} {me} {opp} waiting={remaining <= 0} />
        {:else if v.phase === 'countdown'}
          <Countdown {v} {remaining} />
        {:else if v.q}
          <QuestionStage {v} {me} {opp} />
        {/if}
      </div>
    {/key}
  </div>

  {#if v.phase === 'over'}
    <Victory {v} {me} {opp} />
  {/if}
</main>

<style>
  main { max-width: 1000px; margin: 0 auto; padding: 1rem 16px 0; }
  .stage { margin-top: 1.3rem; }
  main.sudden :global(.question) { box-shadow: var(--shadow), 0 0 0 3px var(--crimson-hi), 0 0 40px rgb(155 28 28 / 0.55); }
  @media (max-width: 640px) { main { padding-top: 0.6rem; } }
</style>
