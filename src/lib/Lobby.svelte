<script>
  import { game, createRoom, joinRoom, leave, TARGET } from './game.svelte.js';

  const NAME_KEY = 'certamen.name';
  let name = $state(load());
  let copied = $state(false);
  let joinId = $state(readHash());

  function load() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
  function save() { try { localStorage.setItem(NAME_KEY, name.trim()); } catch {} }
  function readHash() { return new URLSearchParams(location.hash.slice(1)).get('arena') || ''; }

  $effect(() => {
    const onHash = () => (joinId = readHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  });

  const link = $derived(game.roomId ? `${location.origin}${location.pathname}#arena=${game.roomId}` : '');

  function found() { save(); createRoom(name); }
  function enter() { save(); joinRoom(joinId, name); }
  function home() { leave(); joinId = ''; }

  async function copy() {
    try { await navigator.clipboard.writeText(link); } catch {
      const t = document.createElement('textarea'); t.value = link; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    copied = true;
    setTimeout(() => (copied = false), 1800);
  }
</script>

<main>
  <header>
    <div class="eagle" aria-hidden="true">🦅</div>
    <h1>Certamen<br /><span>Romanum</span></h1>
    <p class="motto caps">Duo intrant · Unus vincit</p>
    <div class="meander"></div>
  </header>

  <section class="tablet card">
    {#if game.status === 'error' || game.status === 'disconnected'}
      <h2 class="caps">{game.status === 'error' ? 'Infortunium' : 'Rival fled the arena'}</h2>
      <p>{game.status === 'error' ? game.error : 'The connection to your rival was lost.'}</p>
      <div class="row">
        {#if joinId}<button class="btn" onclick={enter}>Try again</button>{/if}
        <button class="btn ghost dark" onclick={home}>Back to the forum</button>
      </div>
    {:else if game.status === 'creating' || game.status === 'connecting'}
      <h2 class="caps">{game.status === 'creating' ? 'Building the arena…' : 'Marching to the arena…'}</h2>
      <div class="spinner" aria-hidden="true"></div>
    {:else if game.status === 'waiting'}
      <h2 class="caps">Arena prepared</h2>
      <p>Send this link to your rival. The battle begins the moment they enter.</p>
      <div class="link">
        <code>{link}</code>
        <button class="btn" onclick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
      </div>
      <p class="waiting caps"><span class="dot"></span> Awaiting your rival…</p>
      <p class="hint">Keep this tab open — your browser hosts the match.</p>
      <button class="btn ghost dark" onclick={home}>Abandon arena</button>
    {:else}
      {#if joinId}
        <h2 class="caps">You have been summoned</h2>
        <p>A rival awaits you in arena <b class="caps">{joinId}</b>.</p>
      {:else}
        <h2 class="caps">Enter the Colosseum</h2>
        <p>Found an arena, then send the link to your rival.</p>
      {/if}
      <label>
        <span class="caps">Your gladiator name</span>
        <input class="field" bind:value={name} maxlength="18" placeholder="e.g. Maximus"
          onkeydown={(e) => e.key === 'Enter' && (joinId ? enter() : found())} />
      </label>
      <div class="row">
        {#if joinId}
          <button class="btn" onclick={enter}>⚔ Enter the arena</button>
          <button class="btn ghost dark" onclick={home}>Found my own</button>
        {:else}
          <button class="btn" onclick={found}>🏛 Found an arena</button>
        {/if}
      </div>
    {/if}
  </section>

  <section class="rules">
    <h3 class="caps">Leges Certaminis</h3>
    <ul>
      <li><b>X</b> seconds per question, four answers, one truth.</li>
      <li>First to <b>{TARGET}</b> points is crowned victor.</li>
      <li>At <b>X – X</b>: <i>mors subita</i>. The first to strike true while the other misses wins.</li>
      <li>Every <b>III</b> questions both gladiators vote for the next theme. Split vote? Fortuna decides.</li>
      <li>Questions are rated <b>IV–X</b> in difficulty.</li>
    </ul>
  </section>
</main>

<style>
  main {
    max-width: 640px;
    margin: 0 auto;
    padding: 2rem 16px 0;
  }
  header { text-align: center; margin-bottom: 1.8rem; }
  .eagle { font-size: 2.6rem; filter: sepia(1) saturate(3) hue-rotate(5deg) drop-shadow(0 2px 8px rgb(212 175 55 / 0.5)); }
  h1 {
    font-family: var(--f-display);
    font-size: clamp(2.4rem, 9vw, 4rem);
    line-height: 0.95;
    margin: 0.3rem 0 0.6rem;
    background: linear-gradient(180deg, var(--gold-hi), var(--gold) 55%, var(--gold-lo));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 3px 0 rgb(0 0 0 / 0.5));
  }
  h1 span { font-size: 0.7em; }
  .motto { color: var(--gold-hi); opacity: 0.8; font-size: 0.85rem; margin: 0 0 1rem; }

  .card { padding: 1.6rem 1.4rem; text-align: center; }
  .card h2 { margin: 0 0 0.6rem; font-size: 1.25rem; color: var(--crimson); }
  .card p { font-size: 1.15rem; margin: 0.4rem 0 1rem; }
  label { display: block; text-align: left; margin: 1.2rem 0; }
  label span { display: block; font-size: 0.75rem; color: var(--ink-soft); margin-bottom: 0.4rem; }
  .row { display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap; }
  .btn.dark { color: var(--ink); border-color: var(--gold-lo); }

  .link { display: flex; gap: 0.6rem; align-items: stretch; flex-wrap: wrap; margin: 1rem 0; }
  .link code {
    flex: 1 1 260px;
    min-width: 0;
    overflow-wrap: anywhere;
    text-align: left;
    padding: 0.7em 0.8em;
    background: rgb(43 29 18 / 0.08);
    border: 1px dashed var(--gold-lo);
    border-radius: var(--radius);
    font-size: 0.9rem;
  }
  .waiting { display: flex; justify-content: center; align-items: center; gap: 0.6rem; color: var(--crimson); font-size: 0.9rem; }
  .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--crimson); animation: pulse 1.2s infinite; }
  .hint { font-size: 0.95rem !important; color: var(--ink-soft); font-style: italic; }
  @keyframes pulse { 50% { opacity: 0.25; transform: scale(0.7); } }

  .spinner {
    width: 46px; height: 46px; margin: 1rem auto;
    border: 4px solid rgb(138 106 18 / 0.25); border-top-color: var(--gold-lo);
    border-radius: 50%; animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .rules { margin: 2rem auto 0; max-width: 520px; }
  .rules h3 { color: var(--gold); text-align: center; font-size: 0.95rem; }
  .rules ul { list-style: none; padding: 0; margin: 0; }
  .rules li {
    padding: 0.55rem 0 0.55rem 1.8rem;
    position: relative;
    font-size: 1.08rem;
    border-bottom: 1px solid rgb(212 175 55 / 0.15);
  }
  .rules li::before { content: '🌿'; position: absolute; left: 0; top: 0.5rem; font-size: 0.95rem; }
  .rules b { color: var(--gold-hi); font-family: var(--f-caps); }
</style>
