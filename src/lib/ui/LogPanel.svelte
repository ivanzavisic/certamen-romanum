<script>
  import { logs } from '../log.svelte.js';

  let copied = $state(false);

  async function copy() {
    const text = logs.join('\n');
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea');
      t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove();
    }
    copied = true;
    setTimeout(() => (copied = false), 1800);
  }
</script>

<details>
  <summary class="caps">Connection log ({logs.length})</summary>
  <pre>{logs.join('\n')}</pre>
  <button class="btn ghost" onclick={copy}>{copied ? 'Copied ✓' : 'Copy log'}</button>
</details>

<style>
  details {
    margin: 2rem auto 0;
    max-width: 680px;
    border: 1px solid rgb(212 175 55 / 0.3);
    border-radius: var(--radius);
    padding: 0.6rem 0.9rem;
    background: rgb(0 0 0 / 0.25);
  }
  summary { cursor: pointer; color: var(--gold-hi); font-size: 0.9rem; }
  pre {
    max-height: 260px;
    overflow: auto;
    font-size: 0.78rem;
    line-height: 1.4;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    color: var(--text-muted);
    margin: 0.8rem 0;
  }
  .btn { font-size: 0.85rem; padding: 0.5em 1em; }
</style>
