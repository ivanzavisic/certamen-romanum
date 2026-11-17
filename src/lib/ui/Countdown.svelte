<script>
  import { roman } from '../roman.js';

  let { v, remaining } = $props();

  const n = $derived(Math.max(1, Math.ceil(remaining / 1000)));
</script>

<section>
  <p class="theme caps">{v.theme?.icon} {v.theme?.name}</p>
  <p class="label caps">Question {v.round + 1} · get ready</p>
  <div class="ring">
    {#key n}
      <span class="num">{roman(n)}</span>
    {/key}
  </div>
</section>

<style>
  section { text-align: center; padding: 1.5rem 0 1rem; }
  .theme { color: var(--gold-hi); font-size: 1.15rem; margin: 0; }
  .label { color: var(--text-muted); font-size: 1rem; margin: 0.3rem 0 1.4rem; }
  .ring {
    position: relative;
    width: 210px; height: 210px; margin: 0 auto;
    display: grid; place-items: center;
    border-radius: 50%;
    background: radial-gradient(circle, rgb(212 175 55 / 0.18), rgb(0 0 0 / 0.5) 70%);
    border: 3px double var(--gold);
    box-shadow: 0 0 50px rgb(212 175 55 / 0.25), inset 0 0 30px rgb(0 0 0 / 0.6);
  }
  .ring::before {
    content: ''; position: absolute; inset: -14px; border-radius: 50%;
    border: 2px dashed rgb(212 175 55 / 0.35);
    animation: spin 6s linear infinite;
  }
  .num {
    grid-area: 1 / 1;
    font-family: var(--f-display); font-weight: 900; font-size: 6.5rem; line-height: 1;
    color: var(--gold-hi); text-shadow: 0 4px 0 rgb(0 0 0 / 0.6), 0 0 30px rgb(246 220 132 / 0.5);
    animation: slam 0.9s cubic-bezier(.2, 1.4, .4, 1) both;
  }
  @keyframes slam {
    0% { transform: scale(2.2); opacity: 0; }
    35% { transform: scale(1); opacity: 1; }
    85% { transform: scale(0.95); opacity: 1; }
    100% { transform: scale(0.7); opacity: 0; }
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (max-width: 640px) {
    .ring { width: 160px; height: 160px; }
    .num { font-size: 4.8rem; }
  }
</style>
