<script lang="ts">
  import { revealLabel } from '../lib/platform'
  import { onMount, onDestroy } from 'svelte'
  import { openId, openExternally } from '../lib/store'
  import { loadFont } from '../lib/render'
  import Icon from './Icon.svelte'

  let { item }: { item: RakItem } = $props()

  const SIZES = [12, 16, 24, 36, 48, 72, 96]
  const GLYPHS =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?&@#$%*()[]{}.,:;\'"-+=/'

  let family = $state('')
  let error = $state('')
  let sample = $state('The quick brown fox jumps over the lazy dog')

  onMount(async () => {
    try {
      family = await loadFont(item.id)
    } catch {
      error = 'This font could not be loaded.'
    }
  })

  function close() {
    openId.set(null)
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) close()
  }
  onMount(() => window.addEventListener('keydown', onKey))
  onDestroy(() => window.removeEventListener('keydown', onKey))
</script>

<div class="overlay">
  <div class="bar">
    <Icon name="type" size={15} />
    <span class="name">{item.name}.{item.ext}</span>
    <span class="spacer"></span>
    <button onclick={() => openExternally(item.id)} title="Open in default app"><Icon name="app" size={16} /></button>
    <button onclick={() => window.rak.revealItem(item.id)} title={revealLabel}><Icon name="reveal" size={16} /></button>
    <button onclick={close} title="Close"><Icon name="x" size={18} /></button>
  </div>

  <div class="sheet">
    {#if error}
      <p class="error">{error}</p>
    {:else if family}
      <input class="sample-input" bind:value={sample} spellcheck="false" placeholder="Type to preview…" />
      <div class="sizes" style="font-family:'{family}'">
        {#each SIZES as size (size)}
          <div class="row">
            <span class="px">{size}</span>
            <span class="text" style="font-size:{size}px">{sample || ' '}</span>
          </div>
        {/each}
      </div>
      <div class="glyphs" style="font-family:'{family}'">
        {#each GLYPHS as g, i (i)}<span class="glyph">{g}</span>{/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 220;
    background: rgba(0, 0, 0, 0.88);
    display: flex;
    flex-direction: column;
  }
  .bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    color: #e7e7ea;
    flex-shrink: 0;
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
  .sheet {
    flex: 1;
    overflow: auto;
    margin: 0 auto 32px;
    width: min(1000px, calc(100% - 48px));
    padding: 28px 32px;
    background: #fafafa;
    color: #18181b;
    border-radius: 14px;
    user-select: text;
  }
  .sample-input {
    width: 100%;
    padding: 10px 12px;
    margin-bottom: 18px;
    font-size: 14px;
    color: #18181b;
    background: #fff;
    border: 1px solid #d4d4d8;
    border-radius: 8px;
    outline: none;
  }
  .sample-input:focus {
    border-color: var(--accent);
  }
  .row {
    display: flex;
    align-items: baseline;
    gap: 16px;
    padding: 6px 0;
    border-bottom: 1px solid #e4e4e7;
  }
  .px {
    width: 28px;
    flex-shrink: 0;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    font-size: 11px;
    color: #a1a1aa;
    text-align: right;
  }
  .text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.25;
  }
  .glyphs {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 6px;
    margin-top: 24px;
  }
  .glyph {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 56px;
    font-size: 28px;
    background: #fff;
    border: 1px solid #e4e4e7;
    border-radius: 8px;
  }
  .error {
    color: #18181b;
  }
</style>
