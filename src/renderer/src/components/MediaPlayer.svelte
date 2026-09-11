<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { openId } from '../lib/store'
  import Icon from './Icon.svelte'

  let { item }: { item: RakItem } = $props()

  const src = $derived(`asset://original/${item.id}`)

  function close() {
    openId.set(null)
  }
  function reveal() {
    window.rak.revealItem(item.id)
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
  }
  onMount(() => window.addEventListener('keydown', onKey))
  onDestroy(() => window.removeEventListener('keydown', onKey))
</script>

<div class="overlay" onclick={close} role="presentation">
  <div class="bar" onclick={(e) => e.stopPropagation()} role="presentation">
    <Icon name={item.kind === 'audio' ? 'music' : 'film'} size={15} />
    <span class="name">{item.name}.{item.ext}</span>
    <span class="spacer"></span>
    <button onclick={reveal} title="Reveal in Finder"><Icon name="reveal" size={16} /></button>
    <button onclick={close} title="Close"><Icon name="x" size={18} /></button>
  </div>

  <div class="stage" onclick={(e) => e.stopPropagation()} role="presentation">
    {#if item.kind === 'video'}
      <!-- svelte-ignore a11y_media_has_caption -->
      <video {src} controls autoplay></video>
    {:else}
      <div class="audio">
        <div class="cover"><Icon name="music" size={64} strokeWidth={1.2} /></div>
        <div class="track">{item.name}.{item.ext}</div>
        <audio {src} controls autoplay></audio>
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 40px 40px;
  }
  .bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    color: #e7e7ea;
  }
  .name {
    font-weight: 600;
    font-size: 14px;
  }
  .spacer {
    flex: 1;
  }
  .bar button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 8px;
    color: #e7e7ea;
  }
  .bar button:hover {
    background: rgba(255, 255, 255, 0.18);
  }
  .stage {
    max-width: 100%;
    max-height: 100%;
    display: flex;
  }
  video {
    max-width: 100%;
    max-height: 80vh;
    border-radius: 8px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    background: #000;
  }
  .audio {
    width: 460px;
    max-width: 90vw;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
    padding: 32px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 16px;
  }
  .cover {
    width: 160px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    color: var(--text-dim);
    background: linear-gradient(160deg, #2f2f3a, #232329);
  }
  .track {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    text-align: center;
    word-break: break-word;
  }
  audio {
    width: 100%;
  }
</style>
