<script>
  import { game, answer } from '../game.svelte.js';
  import { sfx } from '../sound.svelte.js';

  let { v, me, opp } = $props();

  const LETTERS = ['A', 'B', 'C', 'D'];
  const revealed = $derived(v.phase === 'reveal' || v.phase === 'over');
  const isRight = (role) => revealed && v.answers?.[role]?.choice === v.correct;
  const fmt = (ms) => (ms / 1000).toFixed(2) + ' s';
  const faster = $derived.by(() => {
    if (!isRight('host') || !isRight('guest')) return null;
    return v.answers.host.ms <= v.answers.guest.ms ? 'host' : 'guest';
  });

  function verdict(role) {
    const a = v.answers?.[role];
    if (!a) return { cls: 'silent', word: 'Tacuit', sub: 'No answer — time ran out' };
    const sub = `Answered ${LETTERS[a.choice]} in ${fmt(a.ms)}`;
    return a.choice === v.correct ? { cls: 'right', word: 'Verum', sub } : { cls: 'wrong', word: 'Falsum', sub };
  }

  function choose(i) {
    if (v.phase !== 'question' || game.myChoice !== null) return;
    sfx.select();
    answer(i);
  }
</script>

<svelte:window onkeydown={(e) => {
  if (e.target instanceof HTMLInputElement) return;
  const i = ['1', '2', '3', '4'].indexOf(e.key) >= 0 ? ['1', '2', '3', '4'].indexOf(e.key) : ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
  if (i >= 0) choose(i);
}} />

<section>
  <article class="question tablet">
    <div class="qhead">
      <span class="chip">{v.theme?.icon} {v.theme?.name}</span>
      <span class="grade" title="Difficulty {v.q.d} of 10">
        Difficulty {v.q.d}/10
        <span class="gpips" aria-hidden="true">{#each Array(10) as _, k}<i class:on={k < v.q.d}></i>{/each}</span>
      </span>
    </div>
    <h2>{v.q.text}</h2>
  </article>

  {#if revealed}
    <div class="verdicts">
      {#each [me, opp] as role (role)}
        {@const vd = verdict(role)}
        <div class="verdict {vd.cls} {role}">
          <div class="vname">{v.names[role]}{role === me ? ' (you)' : ''}</div>
          <div class="stamp">{vd.word}</div>
          <div class="vsub">{vd.sub}</div>
          {#if vd.cls === 'right'}<div class="plus">+1</div>{/if}
          {#if faster === role}<div class="primus">🌿 Faster</div>{/if}
        </div>
      {/each}
    </div>
  {/if}

  <div class="options">
    {#each v.q.options as opt, i}
      {@const pickers = revealed ? ['host', 'guest'].filter((r) => v.answers?.[r]?.choice === i) : []}
      <button class="opt" style:--i={i}
        class:mine={game.myChoice === i}
        class:locked={game.myChoice !== null && game.myChoice !== i && !revealed}
        class:correct={revealed && v.correct === i}
        class:wrong={revealed && v.correct !== i && pickers.length > 0}
        class:faded={revealed && v.correct !== i && pickers.length === 0}
        disabled={v.phase !== 'question' || game.myChoice !== null}
        onclick={() => choose(i)}>
        <span class="letter">{LETTERS[i]}</span>
        <span class="text">{opt}</span>
        {#if pickers.length}
          <span class="pickers">
            {#each pickers as r}<span class="pk {r}">{r === me ? 'You' : v.names[r]}</span>{/each}
          </span>
        {/if}
      </button>
    {/each}
  </div>
  {#if v.phase === 'question'}
    <p class="keys">{game.myChoice === null ? 'Tip: keys A–D or 1–4 answer too.' : 'Answer locked. Waiting for your rival…'}</p>
  {/if}
</section>

<style>
  .question { padding: 1.3rem 1.5rem 1.4rem; }
  .qhead { display: flex; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; align-items: center; }
  .chip { font-family: var(--f-caps); font-weight: 700; font-size: 0.95rem; color: var(--crimson); }
  .grade { font-family: var(--f-caps); font-weight: 700; font-size: 0.9rem; color: var(--ink-soft); display: inline-flex; align-items: center; gap: 0.5rem; }
  .gpips { display: inline-flex; gap: 2px; }
  .gpips i { width: 7px; height: 14px; background: rgb(43 29 18 / 0.15); border-radius: 1px; }
  .gpips i.on { background: var(--gold-lo); }
  .question h2 {
    font-family: var(--f-body); font-weight: 700; font-size: clamp(1.5rem, 3.8vw, 2.15rem);
    line-height: 1.3; margin: 0.9rem 0 0; text-align: center; color: var(--ink);
    text-wrap: balance;
  }

  .options { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; margin-top: 1.1rem; }
  .opt {
    position: relative; display: flex; align-items: center; gap: 0.9rem; text-align: left;
    padding: 1rem 1.1rem; min-height: 76px; border-radius: var(--radius);
    background: linear-gradient(180deg, rgb(255 255 255 / 0.09), rgb(0 0 0 / 0.28));
    border: 2px solid rgb(212 175 55 / 0.55); color: var(--text);
    font-size: 1.35rem; font-weight: 600; line-height: 1.25;
    transition: transform 0.15s, background 0.25s, box-shadow 0.25s, opacity 0.35s, border-color 0.25s;
    animation: deal 0.35s ease-out backwards;
    animation-delay: calc(var(--i) * 50ms);
  }
  .opt:hover:not(:disabled) { transform: translateY(-3px); background: rgb(212 175 55 / 0.18); border-color: var(--gold-hi); }
  .letter {
    flex: none; width: 2.5rem; height: 2.5rem; display: grid; place-items: center;
    border-radius: 50%; font-family: var(--f-caps); font-weight: 900; font-size: 1.15rem;
    border: 2px solid var(--gold); color: var(--gold-hi); background: rgb(0 0 0 / 0.4);
  }
  .text { flex: 1; }
  .opt.mine { background: rgb(212 175 55 / 0.28); border-color: var(--gold-hi); box-shadow: 0 0 0 2px var(--gold-hi); }
  .opt.locked { opacity: 0.6; }
  .opt.correct {
    opacity: 1;
    background: linear-gradient(180deg, rgb(111 191 95 / 0.55), rgb(63 125 58 / 0.65));
    border-color: var(--laurel-hi); box-shadow: 0 0 0 2px var(--laurel-hi), 0 0 30px rgb(111 191 95 / 0.55);
    animation: pop 0.45s ease-out;
  }
  .opt.correct .letter { background: var(--laurel); color: #fff; border-color: var(--laurel-hi); }
  .opt.wrong { opacity: 1; background: linear-gradient(180deg, rgb(179 38 30 / 0.55), rgb(110 20 15 / 0.65)); border-color: #ff7a6b; }
  .opt.faded { opacity: 0.38; }
  .pickers { display: inline-flex; gap: 4px; flex-wrap: wrap; justify-content: flex-end; }
  .pk {
    padding: 0.15rem 0.55rem; border-radius: 999px;
    font-family: var(--f-caps); font-weight: 700; font-size: 0.8rem;
    background: var(--crimson); border: 2px solid var(--gold-hi); color: #fff;
    max-width: 8rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .pk.guest { background: var(--azure); }
  .keys { text-align: center; color: var(--text-muted); font-size: 1.05rem; margin: 0.9rem 0 0; }

  .verdicts { display: grid; grid-template-columns: 1fr 1fr; gap: 0.9rem; margin-top: 1.1rem; }
  .verdict {
    --c: var(--crimson);
    position: relative; overflow: hidden; text-align: center; padding: 0.8rem 0.6rem 0.9rem;
    border-radius: var(--radius); border: 2px solid var(--gold);
    background: linear-gradient(180deg, color-mix(in srgb, var(--c) 55%, #000), color-mix(in srgb, var(--c) 22%, #000));
    animation: slam 0.45s cubic-bezier(.2, 1.6, .4, 1);
  }
  .verdict.guest { --c: var(--azure); }
  .verdict:nth-child(2) { animation-delay: 0.12s; animation-fill-mode: backwards; }
  .vname { font-family: var(--f-caps); font-weight: 700; font-size: 1.05rem; }
  .stamp {
    display: inline-block; margin: 0.3rem 0; padding: 0.05rem 0.9rem;
    font-family: var(--f-display); font-size: 2rem; font-weight: 900; letter-spacing: 0.1em;
    border: 3px double currentColor; border-radius: 4px; transform: rotate(-4deg);
  }
  .verdict.right .stamp { color: #8fe37d; }
  .verdict.wrong .stamp { color: #ff8a7b; }
  .verdict.silent .stamp { color: #d6cbb8; }
  .vsub { font-size: 1.1rem; color: var(--text-muted); }
  .plus {
    position: absolute; top: 0.4rem; right: 0.7rem;
    font-family: var(--f-caps); font-weight: 900; font-size: 1.4rem; color: var(--gold-hi);
    animation: float 1.4s ease-out both;
  }
  .primus { position: absolute; top: 0.5rem; left: 0.7rem; font-family: var(--f-caps); font-size: 0.85rem; font-weight: 900; color: var(--gold-hi); }

  @keyframes deal { from { opacity: 0; transform: translateY(12px); } }
  @keyframes pop { 0% { transform: scale(0.94); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
  @keyframes slam { 0% { transform: translateY(-14px) scale(1.15); opacity: 0; } 100% { transform: none; opacity: 1; } }
  @keyframes float { 0% { transform: translateY(10px); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-4px); opacity: 1; } }

  @media (max-width: 640px) {
    .question { padding: 1rem 1rem 1.1rem; }
    .options { grid-template-columns: 1fr; gap: 0.6rem; }
    .opt { font-size: 1.2rem; min-height: 62px; padding: 0.75rem 0.9rem; }
    .stamp { font-size: 1.4rem; }
    .vsub { font-size: 0.95rem; }
  }
</style>
