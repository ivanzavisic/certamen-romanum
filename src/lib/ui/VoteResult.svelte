<script>
  let { v, me, opp, waiting } = $props();

  const voteOf = (role) => v.voteOptions.find((t) => t.id === v.votes?.[role]);
</script>

<section>
  <div class="votes">
    {#each [me, opp] as role (role)}
      {@const t = voteOf(role)}
      <div class="vchip {role}">
        <span class="caps">{v.names[role]} voted</span>
        <b>{t ? `${t.icon} ${t.name}` : '— no vote —'}</b>
      </div>
    {/each}
  </div>

  {#if v.voteCoin}
    <div class="coin" aria-hidden="true"><span>🪙</span></div>
    <p class="fortuna caps">Fortuna has spoken</p>
  {/if}

  <div class="chosen tablet">
    <span class="icon">{v.theme?.icon}</span>
    <h2 class="caps">{v.theme?.name}</h2>
    <p class="latin">{v.theme?.latin}</p>
  </div>

  {#if waiting}<p class="oracle">Fetching questions…</p>{/if}
</section>

<style>
  section { text-align: center; }
  .votes { display: flex; justify-content: center; gap: 0.9rem; flex-wrap: wrap; margin-bottom: 1.1rem; }
  .vchip {
    padding: 0.6rem 1rem; border-radius: var(--radius); border: 1px solid var(--gold);
    background: color-mix(in srgb, var(--crimson) 45%, #000);
    display: flex; flex-direction: column; min-width: 200px; font-size: 1.2rem;
  }
  .vchip.guest { background: color-mix(in srgb, var(--azure) 45%, #000); }
  .vchip span { font-size: 0.8rem; color: var(--gold-hi); }
  .coin { font-size: 3.4rem; perspective: 300px; }
  .coin span { display: inline-block; animation: flip 1.2s ease-out; }
  .fortuna { color: var(--gold-hi); margin: 0 0 0.9rem; font-size: 1.1rem; }
  .chosen { display: inline-block; padding: 1.5rem 2.6rem; animation: pop 0.6s ease-out 0.15s backwards; }
  .icon { font-size: 4rem; }
  .chosen h2 { margin: 0.3rem 0 0; color: var(--crimson); font-size: 1.7rem; }
  .latin { margin: 0.2rem 0 0; color: var(--ink-soft); font-style: italic; font-size: 1.2rem; }
  .oracle { color: var(--text-muted); animation: blink 1.2s infinite; font-size: 1.15rem; }
  @keyframes pop { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
  @keyframes flip { 0% { transform: rotateY(0); } 50% { transform: rotateY(900deg) translateY(-34px); } 100% { transform: rotateY(1800deg); } }
  @keyframes blink { 50% { opacity: 0.4; } }
</style>
