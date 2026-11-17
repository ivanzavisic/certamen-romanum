<script>
  import { game, answer, vote, rematch, leave, QUESTION_MS, VOTE_MS } from './game.svelte.js';
  import { roman } from './roman.js';

  const LETTERS = ['I', 'II', 'III', 'IV'];

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
  const phaseMs = $derived(v.phase === 'vote' ? VOTE_MS : QUESTION_MS);
  const secs = $derived(Math.ceil(remaining / 1000));
  const frac = $derived(Math.min(1, remaining / phaseMs));
  const timed = $derived(v.phase === 'question' || v.phase === 'vote');
  const revealed = $derived(v.phase === 'reveal' || v.phase === 'over');
  const last = $derived(v.log.at(-1));

  const isRight = (role) => revealed && v.answers?.[role]?.choice === v.correct;
  const fmt = (ms) => (ms / 1000).toFixed(2) + 's';
  const primus = $derived.by(() => {
    if (!revealed || !isRight('host') || !isRight('guest')) return null;
    return v.answers.host.ms <= v.answers.guest.ms ? 'host' : 'guest';
  });

  function verdict(role) {
    const a = v.answers?.[role];
    if (!a) return { cls: 'silent', word: 'Tacuit', sub: 'no answer' };
    if (a.choice === v.correct) return { cls: 'right', word: 'Verum', sub: `${LETTERS[a.choice]} · ${fmt(a.ms)}` };
    return { cls: 'wrong', word: 'Falsum', sub: `${LETTERS[a.choice]} · ${fmt(a.ms)}` };
  }

  function onKey(e) {
    if (e.target instanceof HTMLInputElement) return;
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    if (i >= 0 && v.phase === 'question') answer(i);
  }

  const voteName = (role) => v.voteOptions.find((t) => t.id === v.votes?.[role]);
</script>

<svelte:window onkeydown={onKey} />

<main class:sudden={v.suddenDeath}>
  <!-- ===== HUD ===== -->
  <div class="hud">
    {#each [me, opp] as role, i (role)}
      <div class="plate {role}" class:mine={i === 0}
        class:flash-right={v.phase === 'reveal' && last?.[role]}
        class:flash-wrong={v.phase === 'reveal' && last && !last[role]}>
        <div class="who">
          <span class="tag caps">{i === 0 ? 'Tu' : 'Hostis'}</span>
          <span class="name">{v.names[role]}</span>
        </div>
        <div class="score">
          {#key v.scores[role]}<b class="num">{roman(v.scores[role])}</b>{/key}
          <small>{v.scores[role]}/{v.target}</small>
        </div>
        <div class="pips" aria-label="{v.scores[role]} of {v.target}">
          {#each Array(v.target) as _, k}<span class:on={k < v.scores[role]}></span>{/each}
        </div>
        <div class="state caps">
          {#if v.phase === 'question'}
            {#if v.answered[role]}<span class="sealed">✓ Sententia lata</span>{:else}<span class="thinking">Cogitat…</span>{/if}
          {:else if v.phase === 'vote'}
            {#if v.voted[role]}<span class="sealed">✓ Voted</span>{:else}<span class="thinking">Choosing…</span>{/if}
          {:else}
            <span class="streak">
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
              <span>{roman(secs)}</span>
            </div>
          {:else}
            <div class="vs caps">{revealed ? '⚖' : 'VS'}</div>
          {/if}
          <div class="round caps">
            {#if v.round > 0}Quaestio {roman(v.round)}{:else}Initium{/if}
          </div>
        </div>
      {/if}
    {/each}
  </div>

  {#if v.suddenDeath && !v.winner}
    <div class="banner caps">☠ Mors Subita ☠ <small>first to strike true while the other misses wins</small></div>
  {/if}

  <!-- ===== STAGE ===== -->
  {#if v.phase === 'vote'}
    <section class="stage">
      <h2 class="title caps">Choose the next battlefield</h2>
      <p class="sub">Three questions per theme. If your votes differ, Fortuna decides.</p>
      <div class="themes">
        {#each v.voteOptions as t (t.id)}
          <button class="theme tablet" class:picked={game.myVote === t.id} class:dim={game.myVote && game.myVote !== t.id}
            disabled={!!game.myVote} onclick={() => vote(t.id)}>
            <span class="icon">{t.icon}</span>
            <span class="tname caps">{t.name}</span>
            <span class="latin">{t.latin}</span>
          </button>
        {/each}
      </div>
    </section>
  {:else if v.phase === 'voteResult'}
    <section class="stage result">
      <div class="votes">
        {#each [me, opp] as role}
          <div class="vchip {role}">
            <span class="caps">{v.names[role]}</span>
            <b>{voteName(role) ? `${voteName(role).icon} ${voteName(role).name}` : '— abstained —'}</b>
          </div>
        {/each}
      </div>
      {#if v.voteCoin}
        <div class="coin" aria-hidden="true"><span>🪙</span></div>
        <p class="fortuna caps">Fortuna has spoken</p>
      {/if}
      <div class="chosen tablet">
        <span class="icon big">{v.theme?.icon}</span>
        <h2 class="caps">{v.theme?.name}</h2>
        <p class="latin">{v.theme?.latin}</p>
      </div>
      {#if remaining <= 0}<p class="oracle caps">Consulting the oracle…</p>{/if}
    </section>
  {:else if v.q}
    <section class="stage">
      <article class="question tablet">
        <div class="qhead">
          <span class="chip caps">{v.theme?.icon} {v.theme?.name}</span>
          <span class="grade caps" title="Difficulty {v.q.d}/10">
            Gradus {roman(v.q.d)}
            <span class="gpips">{#each Array(10) as _, k}<i class:on={k < v.q.d}></i>{/each}</span>
          </span>
        </div>
        <h2>{v.q.text}</h2>
        <div class="meander"></div>
      </article>

      {#if revealed}
        <div class="verdicts">
          {#each [me, opp] as role (role)}
            {@const vd = verdict(role)}
            <div class="verdict {vd.cls} {role}">
              <div class="vname caps">{v.names[role]}</div>
              <div class="stamp caps">{vd.word}</div>
              <div class="vsub">{vd.sub}</div>
              {#if vd.cls === 'right'}<div class="plus caps">+ I</div>{/if}
              {#if primus === role}<div class="primus caps">🌿 Primus</div>{/if}
            </div>
          {/each}
        </div>
      {/if}

      <div class="options">
        {#each v.q.options as opt, i}
          {@const pickers = revealed ? ['host', 'guest'].filter((r) => v.answers?.[r]?.choice === i) : []}
          <button class="opt"
            class:mine={game.myChoice === i}
            class:correct={revealed && v.correct === i}
            class:wrong={revealed && v.correct !== i && pickers.length > 0}
            class:faded={revealed && v.correct !== i && pickers.length === 0}
            disabled={v.phase !== 'question' || game.myChoice !== null}
            onclick={() => answer(i)}>
            <span class="letter caps">{LETTERS[i]}</span>
            <span class="text">{opt}</span>
            {#if pickers.length}
              <span class="pickers">
                {#each pickers as r}<span class="pk {r}" title={v.names[r]}>{v.names[r].slice(0, 1).toUpperCase()}</span>{/each}
              </span>
            {/if}
          </button>
        {/each}
      </div>
      {#if v.phase === 'question'}
        <p class="keys">Keys 1–4 also answer.</p>
      {/if}
    </section>
  {/if}

  <!-- ===== VICTORY ===== -->
  {#if v.phase === 'over'}
    <div class="overlay">
      <div class="victory tablet" class:lost={v.winner !== me}>
        <div class="laurel" aria-hidden="true">{v.winner === me ? '🏆' : '⚱️'}</div>
        <h2 class="caps">{v.winner === me ? 'Victor!' : 'Victus est'}</h2>
        <p class="champion"><b>{v.names[v.winner]}</b> is crowned champion of the arena</p>
        <div class="final">
          <span class={me}>{roman(v.scores[me])}</span>
          <i>–</i>
          <span class={opp}>{roman(v.scores[opp])}</span>
        </div>
        <p class="sub">{v.scores[me]} – {v.scores[opp]} after {v.round} questions</p>
        <div class="row">
          <button class="btn" onclick={rematch} disabled={v.rematch[me]}>
            {v.rematch[me] ? 'Awaiting rival…' : v.rematch[opp] ? '⚔ Accept rematch' : '⚔ Rematch'}
          </button>
          <button class="btn ghost dark" onclick={leave}>Leave</button>
        </div>
        {#if v.rematch[opp] && !v.rematch[me]}<p class="sub">{v.names[opp]} demands a rematch!</p>{/if}
      </div>
    </div>
  {/if}
</main>

<style>
  main { max-width: 980px; margin: 0 auto; padding: 1rem 16px 0; }

  /* ---------- HUD ---------- */
  .hud {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 0.8rem;
    align-items: stretch;
  }
  .plate {
    --c: var(--crimson); --c-hi: var(--crimson-hi);
    position: relative;
    padding: 0.7rem 0.9rem 0.6rem;
    border-radius: var(--radius);
    background: linear-gradient(160deg, color-mix(in srgb, var(--c) 55%, #000), color-mix(in srgb, var(--c) 25%, #000));
    border: 2px solid var(--gold);
    box-shadow: var(--shadow), inset 0 0 0 1px rgb(255 255 255 / 0.08);
    transition: box-shadow 0.3s, transform 0.3s;
    min-width: 0;
  }
  .plate.guest { --c: var(--azure); --c-hi: var(--azure-hi); }
  .plate:not(.mine) { text-align: right; }
  .who { display: flex; flex-direction: column; min-width: 0; }
  .tag { font-size: 0.65rem; color: var(--gold-hi); opacity: 0.8; }
  .name {
    font-family: var(--f-caps); font-weight: 700; font-size: 1.15rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .score { display: flex; align-items: baseline; gap: 0.5rem; margin-top: 0.15rem; }
  .plate:not(.mine) .score { justify-content: flex-end; }
  .num {
    font-family: var(--f-display); font-size: 2.2rem; line-height: 1; color: var(--gold-hi);
    text-shadow: 0 2px 0 rgb(0 0 0 / 0.6);
    display: inline-block; animation: pop 0.5s ease-out;
  }
  .score small { opacity: 0.6; font-size: 0.85rem; }
  .pips { display: flex; gap: 3px; margin: 0.4rem 0 0.35rem; }
  .plate:not(.mine) .pips { flex-direction: row-reverse; }
  .pips span {
    flex: 1; height: 7px; border-radius: 4px 0;
    background: rgb(0 0 0 / 0.35); border: 1px solid rgb(212 175 55 / 0.3);
  }
  .pips span.on { background: linear-gradient(180deg, var(--laurel-hi), var(--laurel)); border-color: var(--gold-hi); }
  .state { font-size: 0.7rem; min-height: 1.1em; }
  .sealed { color: var(--gold-hi); }
  .thinking { opacity: 0.6; animation: blink 1.2s infinite; }
  .streak { display: inline-flex; gap: 4px; }
  .plate:not(.mine) .streak { flex-direction: row-reverse; }
  .streak i { width: 9px; height: 9px; border-radius: 50%; background: var(--wrong); opacity: 0.8; }
  .streak i.ok { background: var(--laurel-hi); }
  .plate.flash-right { box-shadow: 0 0 0 3px var(--laurel-hi), 0 0 28px rgb(111 191 95 / 0.6); transform: translateY(-2px); }
  .plate.flash-wrong { box-shadow: 0 0 0 3px var(--wrong), 0 0 22px rgb(179 38 30 / 0.5); animation: shake 0.4s; }

  .center { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.3rem; min-width: 96px; }
  .timer { position: relative; width: 92px; height: 92px; }
  .timer svg { width: 100%; height: 100%; transform: rotate(-90deg); }
  .timer .track { fill: rgb(0 0 0 / 0.45); stroke: rgb(212 175 55 / 0.2); stroke-width: 7; }
  .timer .bar { fill: none; stroke: var(--gold); stroke-width: 7; stroke-linecap: round; stroke-dasharray: 276.5; }
  .timer span {
    position: absolute; inset: 0; display: grid; place-items: center;
    font-family: var(--f-display); font-size: 1.8rem; color: var(--gold-hi);
  }
  .timer.urgent .bar { stroke: var(--crimson-hi); }
  .timer.urgent span { color: #ff8a7a; animation: pulse 0.5s infinite alternate; }
  .vs {
    width: 92px; height: 92px; display: grid; place-items: center; border-radius: 50%;
    font-family: var(--f-display); font-size: 1.7rem; color: var(--gold-hi);
    background: rgb(0 0 0 / 0.45); border: 2px solid rgb(212 175 55 / 0.5);
  }
  .round { font-size: 0.7rem; color: var(--gold-hi); opacity: 0.85; white-space: nowrap; }

  .banner {
    margin: 0.9rem 0 0; padding: 0.55rem 1rem; text-align: center;
    background: linear-gradient(90deg, transparent, rgb(155 28 28 / 0.85), transparent);
    color: #ffd7c9; font-weight: 900; letter-spacing: 0.3em;
    animation: pulse 1s infinite alternate;
  }
  .banner small { display: block; letter-spacing: 0.08em; font-weight: 500; opacity: 0.8; text-transform: none; font-family: var(--f-body); font-size: 0.9rem; }

  /* ---------- STAGE ---------- */
  .stage { margin-top: 1.2rem; animation: rise 0.35s ease-out; }
  .title { text-align: center; color: var(--gold-hi); margin: 0.6rem 0 0.2rem; font-size: 1.3rem; }
  .sub { text-align: center; opacity: 0.75; margin: 0 0 1rem; font-size: 1.05rem; }

  .themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.9rem; }
  .theme {
    display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
    padding: 1.1rem 0.6rem; transition: transform 0.15s, opacity 0.2s, box-shadow 0.2s;
  }
  .theme:hover:not(:disabled) { transform: translateY(-3px); }
  .theme.picked { box-shadow: 0 0 0 3px var(--gold-hi), 0 0 30px rgb(212 175 55 / 0.6); transform: scale(1.03); }
  .theme.dim { opacity: 0.45; }
  .icon { font-size: 2rem; }
  .icon.big { font-size: 3.6rem; }
  .tname { font-weight: 700; font-size: 0.85rem; color: var(--ink); }
  .latin { font-style: italic; color: var(--ink-soft); font-size: 0.95rem; }

  .result { text-align: center; }
  .votes { display: flex; justify-content: center; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 1rem; }
  .vchip {
    padding: 0.5rem 0.9rem; border-radius: var(--radius); border: 1px solid var(--gold);
    background: color-mix(in srgb, var(--crimson) 40%, #000); display: flex; flex-direction: column; min-width: 160px;
  }
  .vchip.guest { background: color-mix(in srgb, var(--azure) 40%, #000); }
  .vchip span { font-size: 0.7rem; opacity: 0.8; }
  .coin { font-size: 3rem; perspective: 300px; }
  .coin span { display: inline-block; animation: flip 1.2s ease-out; }
  .fortuna { color: var(--gold-hi); margin: 0 0 0.8rem; }
  .chosen { display: inline-block; padding: 1.4rem 2.4rem; animation: pop 0.6s ease-out; }
  .chosen h2 { margin: 0.3rem 0 0; color: var(--crimson); }
  .chosen .latin { margin: 0.2rem 0 0; }
  .oracle { opacity: 0.7; animation: blink 1.2s infinite; }

  .question { padding: 1.2rem 1.4rem 0.9rem; }
  .qhead { display: flex; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
  .chip { font-size: 0.72rem; font-weight: 700; color: var(--crimson); }
  .grade { font-size: 0.72rem; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 0.5rem; }
  .gpips { display: inline-flex; gap: 2px; }
  .gpips i { width: 6px; height: 12px; background: rgb(43 29 18 / 0.15); border-radius: 1px; }
  .gpips i.on { background: var(--gold-lo); }
  .question h2 {
    font-family: var(--f-body); font-weight: 600; font-size: clamp(1.25rem, 3.4vw, 1.75rem);
    line-height: 1.3; margin: 0.8rem 0 0.9rem; text-align: center;
  }
  .question .meander { filter: brightness(0.6); }

  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-top: 1rem; }
  .opt {
    position: relative; display: flex; align-items: center; gap: 0.8rem; text-align: left;
    padding: 0.9rem 1rem; min-height: 64px; border-radius: var(--radius);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.06), rgb(0 0 0 / 0.25));
    border: 1px solid rgb(212 175 55 / 0.5); color: var(--marble); font-size: 1.12rem;
    transition: transform 0.12s, background 0.2s, box-shadow 0.2s, opacity 0.3s;
  }
  .opt:hover:not(:disabled) { transform: translateY(-2px); background: rgb(212 175 55 / 0.14); }
  .letter {
    flex: none; width: 2.4rem; height: 2.4rem; display: grid; place-items: center;
    border-radius: 50%; font-weight: 900; font-size: 0.85rem;
    border: 1px solid var(--gold); color: var(--gold-hi); background: rgb(0 0 0 / 0.35);
  }
  .text { flex: 1; }
  .opt.mine { background: rgb(212 175 55 / 0.22); box-shadow: 0 0 0 2px var(--gold); }
  .opt.correct {
    background: linear-gradient(180deg, rgb(111 191 95 / 0.45), rgb(63 125 58 / 0.55));
    border-color: var(--laurel-hi); box-shadow: 0 0 0 2px var(--laurel-hi), 0 0 26px rgb(111 191 95 / 0.5);
    animation: pop 0.45s ease-out;
  }
  .opt.correct .letter { background: var(--laurel); color: #fff; border-color: var(--laurel-hi); }
  .opt.wrong { background: linear-gradient(180deg, rgb(179 38 30 / 0.45), rgb(110 20 15 / 0.55)); border-color: var(--wrong); }
  .opt.faded { opacity: 0.4; }
  .pickers { display: inline-flex; gap: 4px; }
  .pk {
    width: 1.7rem; height: 1.7rem; border-radius: 50%; display: grid; place-items: center;
    font-family: var(--f-caps); font-weight: 900; font-size: 0.8rem;
    background: var(--crimson); border: 2px solid var(--gold-hi); color: #fff;
  }
  .pk.guest { background: var(--azure); }
  .keys { text-align: center; opacity: 0.4; font-size: 0.85rem; margin: 0.8rem 0 0; }

  .verdicts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; margin-top: 1rem; }
  .verdict {
    --c: var(--crimson);
    position: relative; overflow: hidden; text-align: center; padding: 0.7rem 0.6rem 0.8rem;
    border-radius: var(--radius); border: 2px solid var(--gold);
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 50%, #000), color-mix(in srgb, var(--c) 20%, #000));
    animation: slam 0.45s cubic-bezier(.2, 1.6, .4, 1);
  }
  .verdict.guest { --c: var(--azure); }
  .verdict:nth-child(2) { animation-delay: 0.12s; animation-fill-mode: backwards; }
  .vname { font-size: 0.75rem; opacity: 0.85; }
  .stamp {
    display: inline-block; margin: 0.25rem 0; padding: 0.1rem 0.8rem;
    font-family: var(--f-display); font-size: 1.7rem; font-weight: 900; letter-spacing: 0.12em;
    border: 3px double currentColor; border-radius: 4px; transform: rotate(-4deg);
  }
  .verdict.right .stamp { color: var(--laurel-hi); }
  .verdict.wrong .stamp { color: #ff7a6b; }
  .verdict.silent .stamp { color: #bdb3a2; }
  .vsub { font-size: 0.95rem; opacity: 0.85; }
  .plus {
    position: absolute; top: 0.4rem; right: 0.6rem; font-weight: 900; color: var(--gold-hi);
    animation: float 1.4s ease-out both;
  }
  .primus {
    position: absolute; top: 0.45rem; left: 0.6rem; font-size: 0.68rem; font-weight: 900; color: var(--gold-hi);
  }

  /* ---------- VICTORY ---------- */
  .overlay {
    position: fixed; inset: 0; z-index: 10; display: grid; place-items: center; padding: 16px;
    background: radial-gradient(circle, rgb(20 14 10 / 0.75), rgb(20 14 10 / 0.95));
    animation: fade 0.4s;
  }
  .victory { max-width: 440px; width: 100%; padding: 1.6rem 1.4rem; text-align: center; animation: pop 0.6s ease-out; }
  .laurel { font-size: 4rem; filter: drop-shadow(0 4px 12px rgb(212 175 55 / 0.6)); }
  .victory h2 { font-family: var(--f-display); font-size: 2.4rem; margin: 0.2rem 0; color: var(--gold-lo); }
  .victory.lost h2 { color: var(--crimson); }
  .champion { font-size: 1.15rem; margin: 0.2rem 0 0.8rem; }
  .final { display: flex; justify-content: center; align-items: baseline; gap: 0.8rem; font-family: var(--f-display); font-size: 2.6rem; }
  .final .host { color: var(--crimson); }
  .final .guest { color: var(--azure); }
  .victory .sub { color: var(--ink-soft); opacity: 1; }
  .row { display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap; margin-top: 0.6rem; }
  .btn.dark { color: var(--ink); border-color: var(--gold-lo); }

  main.sudden .question { box-shadow: var(--shadow), 0 0 0 2px var(--crimson-hi), 0 0 40px rgb(155 28 28 / 0.5); }

  @keyframes pop { 0% { transform: scale(0.85); opacity: 0; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes slam { 0% { transform: translateY(-14px) scale(1.15); opacity: 0; } 100% { transform: none; opacity: 1; } }
  @keyframes rise { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes fade { from { opacity: 0; } }
  @keyframes blink { 50% { opacity: 0.25; } }
  @keyframes pulse { to { opacity: 0.65; } }
  @keyframes shake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
  @keyframes float { 0% { transform: translateY(8px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-6px); opacity: 1; } }
  @keyframes flip { from { transform: rotateY(0) translateY(0); } 50% { transform: rotateY(900deg) translateY(-30px); } to { transform: rotateY(1800deg); } }

  @media (max-width: 640px) {
    .hud { grid-template-columns: 1fr auto 1fr; gap: 0.4rem; }
    .plate { padding: 0.5rem 0.55rem; }
    .name { font-size: 0.9rem; }
    .num { font-size: 1.5rem; }
    .score small { display: none; }
    .center { min-width: 70px; }
    .timer, .vs { width: 68px; height: 68px; }
    .timer span { font-size: 1.3rem; }
    .vs { font-size: 1.2rem; }
    .themes { grid-template-columns: repeat(2, 1fr); }
    .options { grid-template-columns: 1fr; }
    .stamp { font-size: 1.25rem; }
  }
</style>
