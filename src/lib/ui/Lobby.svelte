<script>
  import { game, createRoom, joinRoom, leave, TARGET } from '../game.svelte.js';
  import { unlock } from '../sound.svelte.js';
  import LogPanel from './LogPanel.svelte';

  const NAME_KEY = 'certamen.name';
  let name = $state(loadName());
  let copied = $state(false);
  let invite = $state(readHash());

  function loadName() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }
  function saveName() { try { localStorage.setItem(NAME_KEY, name.trim()); } catch {} }
  function readHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const room = p.get('arena') || '';
    return room ? { room } : null;
  }

  $effect(() => {
    const onHash = () => (invite = readHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  });

  const link = $derived(
    game.roomId && game.role === 'host'
      ? `${location.origin}${location.pathname}#arena=${game.roomId}`
      : '',
  );

  function found() { unlock(); saveName(); createRoom(name); }
  function enter() { unlock(); saveName(); joinRoom(invite.room, name); }
  function home() { leave(); invite = null; }

  async function copy() {
    try { await navigator.clipboard.writeText(link); } catch {
      const t = document.createElement('textarea');
      t.value = link; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
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
      <h2 class="caps">{game.status === 'error' ? 'Infortunium' : 'Connection lost'}</h2>
      <p>{game.status === 'error' ? game.error : 'The connection to your rival was lost. Rejoining continues the same match if the host is still there.'}</p>
      <div class="row">
        {#if invite}<button class="btn" onclick={enter}>Try again</button>{/if}
        <button class="btn ghost dark" onclick={home}>Back to the forum</button>
      </div>
    {:else if game.status === 'creating' || game.status === 'connecting'}
      <h2 class="caps">{game.status === 'creating' ? 'Building the arena…' : 'Marching to the arena…'}</h2>
      <div class="spinner" aria-hidden="true"></div>
      <p class="hint">{game.status === 'creating' ? 'Connecting to the relay server.' : 'Looking for your rival. This takes a few seconds.'}</p>
    {:else if game.status === 'waiting'}
      <h2 class="caps">Arena prepared</h2>
      <p>Send this link to your rival. The battle begins the moment they enter.</p>
      <div class="link">
        <code>{link}</code>
        <button class="btn" onclick={copy}>{copied ? 'Copied ✓' : 'Copy link'}</button>
      </div>
      <p class="waiting caps"><span class="dot"></span> Awaiting your rival…</p>
      <p class="hint">Keep this tab open — your browser runs the match.</p>
      <button class="btn ghost dark" onclick={home}>Abandon arena</button>
    {:else}
      {#if invite}
        <h2 class="caps">You have been summoned</h2>
        <p>A rival awaits you in arena <b class="caps">{invite.room}</b>.</p>
      {:else}
        <h2 class="caps">Enter the Colosseum</h2>
        <p>Found an arena, then send the link to your rival.</p>
      {/if}
      <label>
        <span class="caps">Your gladiator name</span>
        <input class="field" bind:value={name} maxlength="18" placeholder="e.g. Maximus"
          onkeydown={(e) => e.key === 'Enter' && (invite ? enter() : found())} />
      </label>
      <div class="row">
        {#if invite}
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
      <li><b>10</b> seconds per question, four answers, one truth.</li>
      <li>First to <b>{TARGET}</b> points is crowned victor.</li>
      <li>At <b>10 – 10</b> it's <i>mors subita</i>: the first to answer right while the other misses wins.</li>
      <li>Every <b>3</b> questions you both vote for the next theme. Split vote? Fortuna decides.</li>
      <li>Questions are rated <b>4–10</b> in difficulty.</li>
    </ul>
  </section>

  <LogPanel />
</main>

<style>
  main { max-width: 680px; margin: 0 auto; padding: 2rem 16px 0; }
  header { text-align: center; margin-bottom: 1.8rem; }
  .eagle { font-size: 2.6rem; filter: sepia(1) saturate(3) hue-rotate(5deg) drop-shadow(0 2px 8px rgb(212 175 55 / 0.5)); }
  h1 {
    font-family: var(--f-display);
    font-size: clamp(2.6rem, 10vw, 4.2rem);
    line-height: 0.95;
    margin: 0.3rem 0 0.6rem;
    background: linear-gradient(180deg, var(--gold-hi), var(--gold) 55%, var(--gold-lo));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 3px 0 rgb(0 0 0 / 0.5));
  }
  h1 span { font-size: 0.7em; }
  .motto { color: var(--gold-hi); font-size: 0.95rem; margin: 0 0 1rem; }

  .card { padding: 1.8rem 1.5rem; text-align: center; }
  .card h2 { margin: 0 0 0.6rem; font-size: 1.45rem; color: var(--crimson); }
  .card p { font-size: 1.25rem; margin: 0.4rem 0 1rem; }
  label { display: block; text-align: left; margin: 1.2rem 0; }
  label span { display: block; font-size: 0.9rem; color: var(--ink-soft); margin-bottom: 0.4rem; }
  .row { display: flex; gap: 0.8rem; justify-content: center; flex-wrap: wrap; }
  .btn.dark { color: var(--ink); border-color: var(--gold-lo); }

  .link { display: flex; gap: 0.6rem; align-items: stretch; flex-wrap: wrap; margin: 1rem 0; }
  .link code {
    flex: 1 1 260px; min-width: 0; overflow-wrap: anywhere; text-align: left;
    padding: 0.7em 0.8em; background: rgb(43 29 18 / 0.08);
    border: 1px dashed var(--gold-lo); border-radius: var(--radius); font-size: 1rem;
  }
  .waiting { display: flex; justify-content: center; align-items: center; gap: 0.6rem; color: var(--crimson); font-size: 1rem; }
  .dot { width: 11px; height: 11px; border-radius: 50%; background: var(--crimson); animation: pulse 1.2s infinite; }
  .hint { font-size: 1.1rem !important; color: var(--ink-soft); font-style: italic; }
  @keyframes pulse { 50% { opacity: 0.25; transform: scale(0.7); } }

  .spinner {
    width: 50px; height: 50px; margin: 1rem auto;
    border: 4px solid rgb(138 106 18 / 0.25); border-top-color: var(--gold-lo);
    border-radius: 50%; animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .rules { margin: 2rem auto 0; max-width: 560px; }
  .rules h3 { color: var(--gold); text-align: center; font-size: 1.05rem; }
  .rules ul { list-style: none; padding: 0; margin: 0; }
  .rules li {
    padding: 0.6rem 0 0.6rem 1.9rem; position: relative; font-size: 1.2rem;
    border-bottom: 1px solid rgb(212 175 55 / 0.15);
  }
  .rules li::before { content: '🌿'; position: absolute; left: 0; top: 0.6rem; font-size: 1rem; }
  .rules b { color: var(--gold-hi); font-family: var(--f-caps); }
</style>
