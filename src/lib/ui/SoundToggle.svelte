<script>
  import { sound, toggleMute } from '../sound.svelte.js';
</script>

<button class="mute" onclick={toggleMute} aria-label={sound.muted ? 'Turn sound on' : 'Turn sound off'}
  title={sound.muted ? 'Sound off' : 'Sound on'}>
  {sound.muted ? '🔇' : '🔊'}
</button>

<style>
  .mute {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 20;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    font-size: 1.3rem;
    border: 1px solid rgb(212 175 55 / 0.6);
    background: rgb(20 14 10 / 0.75);
    backdrop-filter: blur(4px);
  }
  .mute:hover { border-color: var(--gold-hi); }
</style>
