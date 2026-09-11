<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { openId, cacheBust, displayed, openAdjacent, cropItem } from '../lib/store'
  import { tooltip } from '../lib/tooltip'
  import Icon from './Icon.svelte'

  let { item }: { item: RakItem } = $props()

  let rotation = $state(0) // degrees: 0 / 90 / 180 / 270
  let flipH = $state(false)
  let mode = $state<'fit' | 'actual'>('fit')
  let cropping = $state(false)
  let imgEl = $state<HTMLImageElement>()

  // Crop selection, in viewport (client) coordinates.
  let sel = $state<{ x: number; y: number; w: number; h: number } | null>(null)
  let dragging = false
  let startX = 0
  let startY = 0

  const canNavigate = $derived($displayed.length > 1)

  // Reset all view state whenever the opened item changes.
  $effect(() => {
    void item.id
    rotation = 0
    flipH = false
    mode = 'fit'
    cropping = false
    sel = null
  })

  const transform = $derived(
    `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`
  )

  function close() {
    openId.set(null)
  }
  function reveal() {
    window.rak.revealItem(item.id)
  }
  function rotate() {
    rotation = (rotation + 90) % 360
  }
  function flip() {
    flipH = !flipH
  }
  function startCrop() {
    rotation = 0
    flipH = false
    mode = 'fit'
    sel = null
    cropping = true
  }
  function cancelCrop() {
    cropping = false
    sel = null
  }

  function onDown(e: MouseEvent) {
    if (!cropping) return
    dragging = true
    startX = e.clientX
    startY = e.clientY
    sel = { x: startX, y: startY, w: 0, h: 0 }
  }
  function onMove(e: MouseEvent) {
    if (!cropping || !dragging) return
    const x = Math.min(startX, e.clientX)
    const y = Math.min(startY, e.clientY)
    sel = { x, y, w: Math.abs(e.clientX - startX), h: Math.abs(e.clientY - startY) }
  }
  function onUp() {
    dragging = false
  }

  async function applyCrop() {
    if (!sel || !imgEl || sel.w < 4 || sel.h < 4) return cancelCrop()
    const r = imgEl.getBoundingClientRect()
    // Intersect the selection with the rendered image.
    const left = Math.max(sel.x, r.left)
    const top = Math.max(sel.y, r.top)
    const right = Math.min(sel.x + sel.w, r.right)
    const bottom = Math.min(sel.y + sel.h, r.bottom)
    if (right - left < 2 || bottom - top < 2) return cancelCrop()
    const scaleX = imgEl.naturalWidth / r.width
    const scaleY = imgEl.naturalHeight / r.height
    const region = {
      left: (left - r.left) * scaleX,
      top: (top - r.top) * scaleY,
      width: (right - left) * scaleX,
      height: (bottom - top) * scaleY
    }
    const ok = await cropItem(item.id, region)
    cropping = false
    sel = null
    if (!ok) console.error('crop failed')
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (cropping) cancelCrop()
      else close()
    } else if (!cropping && e.key === 'ArrowRight') {
      openAdjacent(1)
    } else if (!cropping && e.key === 'ArrowLeft') {
      openAdjacent(-1)
    }
  }
  onMount(() => window.addEventListener('keydown', onKey))
  onDestroy(() => window.removeEventListener('keydown', onKey))
</script>

<svelte:window onmousemove={onMove} onmouseup={onUp} />

<div class="overlay" onclick={close} role="presentation">
  <div class="bar" onclick={(e) => e.stopPropagation()} role="presentation">
    <span class="name">{item.name}.{item.ext}</span>
    <span class="meta">{item.width} × {item.height}</span>
    <span class="spacer"></span>

    {#if cropping}
      <span class="hint">Drag to select a region</span>
      <button class="primary" onclick={applyCrop} use:tooltip={'Apply crop'} aria-label="Apply crop"><Icon name="check" size={16} /> Apply</button>
      <button onclick={cancelCrop}>Cancel</button>
    {:else}
      {#if canNavigate}
        <button onclick={() => openAdjacent(-1)} use:tooltip={'Previous (←)'} aria-label="Previous"><Icon name="chevron-left" size={18} /></button>
        <button onclick={() => openAdjacent(1)} use:tooltip={'Next (→)'} aria-label="Next"><Icon name="chevron-right" size={18} /></button>
        <span class="sep"></span>
      {/if}
      <button onclick={rotate} use:tooltip={'Rotate 90°'} aria-label="Rotate 90°"><Icon name="rotate-cw" size={16} /></button>
      <button class:on={flipH} onclick={flip} use:tooltip={'Flip horizontal'} aria-label="Flip horizontal"><Icon name="flip-horizontal" size={16} /></button>
      <button class:on={mode === 'fit'} onclick={() => (mode = 'fit')} use:tooltip={'Fit to window'} aria-label="Fit to window"><Icon name="maximize" size={16} /></button>
      <button class:on={mode === 'actual'} onclick={() => (mode = 'actual')} use:tooltip={'Actual size (100%)'} aria-label="Actual size"><Icon name="expand" size={16} /></button>
      <button onclick={startCrop} use:tooltip={'Crop'} aria-label="Crop"><Icon name="crop" size={16} /></button>
      <span class="sep"></span>
      <button onclick={reveal} use:tooltip={'Reveal in Finder'} aria-label="Reveal in Finder"><Icon name="reveal" size={16} /></button>
      <button onclick={close} use:tooltip={'Close (Esc)'} aria-label="Close"><Icon name="x" size={18} /></button>
    {/if}
  </div>

  <div
    class="imgwrap"
    class:actual={mode === 'actual'}
    class:cropping
    role="presentation"
    onclick={(e) => e.stopPropagation()}
    onmousedown={onDown}
  >
    <img
      bind:this={imgEl}
      class:fit={mode === 'fit'}
      src={`asset://original/${item.id}?v=${$cacheBust}`}
      alt={item.name}
      style="transform:{transform}"
      draggable="false"
    />
  </div>

  {#if cropping && sel}
    <div class="cropsel" style="left:{sel.x}px; top:{sel.y}px; width:{sel.w}px; height:{sel.h}px"></div>
  {/if}
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
    gap: 8px;
    padding: 12px 16px;
    color: #e7e7ea;
    z-index: 2;
  }
  .name {
    font-weight: 600;
    font-size: 14px;
  }
  .meta {
    color: #9a9aa4;
    font-size: 12px;
  }
  .spacer {
    flex: 1;
  }
  .hint {
    color: #9a9aa4;
    font-size: 12px;
    margin-right: 4px;
  }
  .sep {
    width: 1px;
    height: 20px;
    background: rgba(255, 255, 255, 0.15);
    margin: 0 2px;
  }
  .bar button {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    min-width: 34px;
    justify-content: center;
    padding: 0 10px;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 8px;
    color: #e7e7ea;
    font-size: 13px;
  }
  .bar button:hover {
    background: rgba(255, 255, 255, 0.18);
  }
  .bar button.on {
    background: var(--accent);
    color: #fff;
  }
  .bar button.primary {
    background: var(--accent);
    color: #fff;
  }
  .imgwrap {
    max-width: 100%;
    max-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .imgwrap.actual {
    max-width: 100%;
    max-height: 100%;
    overflow: auto;
    align-items: safe center;
    justify-content: safe center;
  }
  .imgwrap.cropping {
    cursor: crosshair;
  }
  img {
    object-fit: contain;
    border-radius: 6px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    user-select: none;
  }
  img.fit {
    max-width: min(100%, 88vw);
    max-height: 82vh;
  }
  .imgwrap.actual img {
    max-width: none;
    max-height: none;
  }
  .cropsel {
    position: fixed;
    z-index: 3;
    border: 1.5px solid #fff;
    background: rgba(80, 140, 255, 0.18);
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
    pointer-events: none;
  }
</style>
