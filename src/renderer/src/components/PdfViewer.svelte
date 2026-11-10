<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import type { PDFDocumentProxy } from 'pdfjs-dist'
  import { openId, openExternally } from '../lib/store'
  import { openPdf, renderPdfPage } from '../lib/render'
  import Icon from './Icon.svelte'

  let { item }: { item: RakItem } = $props()

  const BASE_W = 820
  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3]

  let doc: PDFDocumentProxy | null = null
  let pageCount = $state(0)
  let ratio = $state(1.294) // page height / width; A4 until the first page is read
  let error = $state('')
  let zoomIndex = $state(2)
  let current = $state(1)
  const zoom = $derived(ZOOMS[zoomIndex])
  const pageW = $derived(Math.round(BASE_W * zoom))

  const canvases: HTMLCanvasElement[] = []
  const renderedAt = new Map<number, number>() // page index → zoom it was drawn at
  const visible = new Set<number>()
  let observer: IntersectionObserver | null = null

  function draw(i: number): void {
    if (!doc || !canvases[i] || renderedAt.get(i) === zoom) return
    renderedAt.set(i, zoom)
    renderPdfPage(doc, i + 1, canvases[i], pageW).catch(() => renderedAt.delete(i))
  }

  // Redraw what is on screen after a zoom change.
  $effect(() => {
    void zoom
    for (const i of visible) draw(i)
  })

  function observe(node: HTMLElement, index: number) {
    node.dataset.index = String(index)
    observer?.observe(node)
    return { destroy: () => observer?.unobserve(node) }
  }

  onMount(async () => {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = Number((e.target as HTMLElement).dataset.index)
          if (e.isIntersecting) {
            visible.add(i)
            draw(i)
          } else visible.delete(i)
        }
        if (visible.size) current = Math.min(...visible) + 1
      },
      { rootMargin: '600px 0px' }
    )
    try {
      doc = await openPdf(item.id)
      const first = (await doc.getPage(1)).getViewport({ scale: 1 })
      ratio = first.height / first.width
      pageCount = doc.numPages
    } catch {
      error = 'This PDF could not be opened.'
    }
  })

  onDestroy(() => {
    observer?.disconnect()
    window.removeEventListener('keydown', onKey)
    void doc?.destroy()
  })

  function close() {
    openId.set(null)
  }
  function zoomBy(step: number) {
    zoomIndex = Math.max(0, Math.min(ZOOMS.length - 1, zoomIndex + step))
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') close()
    else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault()
      zoomBy(1)
    } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
      e.preventDefault()
      zoomBy(-1)
    }
  }
  onMount(() => window.addEventListener('keydown', onKey))
</script>

<div class="overlay">
  <div class="bar">
    <Icon name="note" size={15} />
    <span class="name">{item.name}.{item.ext}</span>
    {#if pageCount}<span class="pages">Page {current} of {pageCount}</span>{/if}
    <span class="spacer"></span>
    <button onclick={() => zoomBy(-1)} disabled={zoomIndex === 0} title="Zoom out"><Icon name="minus" size={16} /></button>
    <span class="zoom">{Math.round(zoom * 100)}%</span>
    <button onclick={() => zoomBy(1)} disabled={zoomIndex === ZOOMS.length - 1} title="Zoom in"><Icon name="plus" size={16} /></button>
    <span class="gap"></span>
    <button onclick={() => openExternally(item.id)} title="Open in default app"><Icon name="app" size={16} /></button>
    <button onclick={() => window.rak.revealItem(item.id)} title="Reveal in Finder"><Icon name="reveal" size={16} /></button>
    <button onclick={close} title="Close"><Icon name="x" size={18} /></button>
  </div>

  <div class="scroller">
    {#if error}
      <p class="error">{error}</p>
    {:else}
      {#each { length: pageCount } as _, i (i)}
        <div class="page" style="width:{pageW}px; min-height:{Math.round(pageW * ratio)}px" use:observe={i}>
          <canvas bind:this={canvases[i]}></canvas>
        </div>
      {/each}
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
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pages,
  .zoom {
    font-size: 12px;
    color: #a1a1aa;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .zoom {
    min-width: 40px;
    text-align: center;
  }
  .spacer {
    flex: 1;
  }
  .gap {
    width: 8px;
  }
  .bar button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 8px;
    color: #e7e7ea;
  }
  .bar button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.18);
  }
  .bar button:disabled {
    opacity: 0.4;
  }
  .scroller {
    flex: 1;
    overflow: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 8px 24px 40px;
  }
  .page {
    flex-shrink: 0;
    background: #fff;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  }
  canvas {
    display: block;
  }
  .error {
    margin: auto;
    color: #e7e7ea;
  }
</style>
