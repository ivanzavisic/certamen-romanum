<script>
  import { game } from '../game.svelte.js';
  import { roman } from '../roman.js';

  /** @type {{ v: any, me: string, opp: string, remaining: number, phaseMs: number }} */
  let { v, me, opp, remaining, phaseMs } = $props();

  const secs = $derived(Math.ceil(remaining / 1000));
  const frac = $derived(Math.min(1, remaining / phaseMs));
  const timed = $derived(v.phase === 'question' || v.phase === 'vote');
  const last = $derived(v.log.at(-1));
  const showFlash = $derived(v.phase === 'reveal' && !!last);
  const nextRound = $derived(v.phase === 'countdown' ? v.round + 1 : v.round);
</script>

<div class="hud">
  {#each [me, opp] as role, i (role)}
    <div class="plate {role}" class:mine={i === 0}
      class:flash-right={showFlash && last[role]}
      class:flash-wrong={showFlash && !last[role]}>
      <div class="who">
        <span class="tag caps">{i === 0 ? 'You' : 'Rival'}</span>
        <span class="name">{v.names[role]}</span>
      </div>
      <div class="score">
        {#key v.scores[role]}<b class="num">{roman(v.scores[role])}</b>{/key}
        <span class="arabic">{v.scores[role]} / {v.target}</span>
      </div>
      <div class="pips" aria-hidden="true">
        {#each Array(v.target) as _, k}<span class:on={k < v.scores[role]}></span>{/each}
      </div>
      <div class="state">
        {#if v.phase === 'question'}
          {#if v.answered[role]}<span class="sealed">✓ Answer locked</span>{:else}<span class="thinking">Thinking…</span>{/if}
        {:else if v.phase === 'vote'}
          {#if v.voted[role]}<span class="sealed">✓ Voted</span>{:else}<span class="thinking">Choosing…</span>{/if}
        {:else}
          <span class="streak" aria-label="Last answers">
            {#each v.log.slice(-8) as r}<i class:ok={r[role]}></i>{/each}
          </span>
        {/if}
      </div>
    </div>

    {#if i === 0}
      <div class="center">
        {#if timed}
          <div class="timer" class:urgent={secs <= 3 && remaining > 0}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <circle cx="50" cy="50" r="44" class="track" />
              <circle cx="50" cy="50" r="44" class="bar" style:stroke-dashoffset={276.5 * (1 - frac)} />
            </svg>
            <span>{secs}</span>
          </div>
        {:else}
          <div class="vs">{v.phase === 'reveal' ? '⚖' : 'VS'}</div>
        {/if}
        <div class="round caps">{nextRound > 0 ? `Question ${nextRound}` : 'Prelude'}</div>
        <div class="net" class:bad={game.link === 'offline'}>
          {#if game.link === 'offline'}reconnecting…{:else if game.rtt != null}ping {game.rtt} ms{/if}
        </div>
      </div>
    {/if}
  {/each}
</div>

{#if v.suddenDeath && !v.winner}
  <div class="banner">
    <span class="caps">☠ Mors Subita ☠</span>
    <small>Sudden death: the first to answer right while the other misses wins</small>
  </div>
{/if}

<style>
  .hud { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.8rem; align-items: stretch; }
  .plate {
    --c: var(--crimson);
    position: relative; min-width: 0;
    padding: 0.75rem 1rem 0.65rem;
    border-radius: var(--radius);
    background: linear-gradient(160deg, color-mix(in srgb, var(--c) 60%, #000), color-mix(in srgb, var(--c) 28%, #000));
    border: 2px solid var(--gold);
    box-shadow: var(--shadow), inset 0 0 0 1px rgb(255 255 255 / 0.08);
    transition: box-shadow 0.35s, transform 0.35s;
  }
  .plate.guest { --c: var(--azure); }
  .plate:not(.mine) { text-align: right; }
  .who { display: flex; flex-direction: column; min-width: 0; }
  .tag { font-size: 0.78rem; color: var(--gold-hi); }
  .name {
    font-family: var(--f-caps); font-weight: 700; font-size: 1.4rem; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .score { display: flex; align-items: baseline; gap: 0.6rem; margin-top: 0.15rem; }
  .plate:not(.mine) .score { flex-direction: row-reverse; }
  .num {
    font-family: var(--f-display); font-size: 2.4rem; line-height: 1; color: var(--gold-hi);
    text-shadow: 0 2px 0 rgb(0 0 0 / 0.6); display: inline-block; animation: pop 0.5s ease-out;
  }
  .arabic { font-family: var(--f-caps); font-weight: 700; font-size: 1.05rem; color: var(--text-muted); }
  .pips { display: flex; gap: 3px; margin: 0.45rem 0 0.4rem; }
  .plate:not(.mine) .pips { flex-direction: row-reverse; }
  .pips span {
    flex: 1; height: 8px; border-radius: 4px 0;
    background: rgb(0 0 0 / 0.35); border: 1px solid rgb(212 175 55 / 0.3);
    transition: background 0.4s;
  }
  .pips span.on { background: linear-gradient(180deg, var(--laurel-hi), var(--laurel)); border-color: var(--gold-hi); }
  .state { font-size: 1rem; min-height: 1.4em; font-weight: 600; }
  .sealed { color: var(--gold-hi); }
  .thinking { color: var(--text-muted); animation: blink 1.2s infinite; }
  .streak { display: inline-flex; gap: 5px; }
  .plate:not(.mine) .streak { flex-direction: row-reverse; }
  .streak i { width: 11px; height: 11px; border-radius: 50%; background: var(--wrong); }
  .streak i.ok { background: var(--laurel-hi); }
  .plate.flash-right { box-shadow: 0 0 0 3px var(--laurel-hi), 0 0 30px rgb(111 191 95 / 0.6); transform: translateY(-2px); }
  .plate.flash-wrong { box-shadow: 0 0 0 3px var(--wrong), 0 0 24px rgb(179 38 30 / 0.55); animation: shake 0.4s; }

  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; min-width: 104px; }
  .timer { position: relative; width: 100px; height: 100px; }
  .timer svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .timer .track { fill: rgb(0 0 0 / 0.5); stroke: rgb(212 175 55 / 0.2); stroke-width: 7; }
  .timer .bar { fill: none; stroke: var(--gold); stroke-width: 7; stroke-linecap: round; stroke-dasharray: 276.5; }
  .timer span {
    position: absolute; inset: 0; display: grid; place-items: center;
    font-family: var(--f-caps); font-weight: 900; font-size: 2.3rem; color: var(--gold-hi);
  }
  .timer.urgent .bar { stroke: var(--crimson-hi); }
  .timer.urgent span { color: #ff9b8c; animation: beat 1s infinite; }
  .vs {
    width: 100px; height: 100px; display: grid; place-items: center; border-radius: 50%;
    font-family: var(--f-display); font-size: 1.8rem; color: var(--gold-hi);
    background: rgb(0 0 0 / 0.5); border: 2px solid rgb(212 175 55 / 0.5);
  }
  .round { font-size: 0.9rem; color: var(--gold-hi); white-space: nowrap; }
  .net { font-size: 0.8rem; color: var(--text-muted); min-height: 1.2em; }
  .net.bad { color: #ff9b8c; }

  .banner {
    margin: 0.9rem 0 0; padding: 0.6rem 1rem; text-align: center;
    background: linear-gradient(90deg, transparent, rgb(155 28 28 / 0.9), transparent);
    color: #ffe0d6; animation: glow 1.2s infinite alternate;
  }
  .banner span { font-weight: 900; letter-spacing: 0.2em; font-size: 1.2rem; }
  .banner small { display: block; font-size: 1.05rem; }

  @keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 60% { transform: scale(1.15); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes blink { 50% { opacity: 0.4; } }
  @keyframes beat { 0%, 100% { transform: scale(1); } 15% { transform: scale(1.18); } }
  @keyframes glow { to { filter: brightness(1.25); } }
  @keyframes shake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }

  @media (max-width: 640px) {
    .hud { gap: 0.4rem; }
    .plate { padding: 0.55rem 0.6rem; }
    .name { font-size: 1.05rem; }
    .num { font-size: 1.7rem; }
    .arabic { font-size: 0.9rem; }
    .state { font-size: 0.85rem; }
    .center { min-width: 76px; }
    .timer, .vs { width: 74px; height: 74px; }
    .timer span { font-size: 1.7rem; }
    .vs { font-size: 1.3rem; }
  }
</style>
