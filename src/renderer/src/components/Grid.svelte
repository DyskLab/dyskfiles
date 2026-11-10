<script lang="ts">
  import {
    displayed,
    view,
    thumbSize,
    selectedId,
    openId,
    addItems,
    applyOrder,
    cacheBust,
    sortKey,
    sortDir,
    layout,
    showName,
    showItemInfo,
    itemInfoField,
    showExtension,
    showExtensionLabel
  } from '../lib/store'
  import Icon from './Icon.svelte'
  import { kindIcon } from '../lib/kind'
  import { untrack } from 'svelte'

  const GAP = 14
  const PAD = 16 // .grid-wrap padding: the canvas starts this far into the scroll area
  const OVERSCAN = 800 // px rendered above and below the viewport
  const LIST_ROW_H = 50
  const LIST_GAP = 2
  // Card label heights, matching the fixed line-heights in the .meta/.name/.info styles.
  const META_PAD = 8
  const NAME_H = 32
  const INFO_H = 16

  const reorderable = $derived($view === 'all' && $sortKey === 'custom' && $sortDir === 'asc')
  const empty = $derived({
    all: { icon: 'image', title: 'This library is empty', sub: 'Drag images here, or use the + Add button.' },
    uncategorized: { icon: 'inbox', title: 'Nothing uncategorized', sub: 'Items not in any folder show up here.' },
    untagged: { icon: 'tag', title: 'Nothing untagged', sub: 'Items with no tags show up here.' },
    recent: { icon: 'clock', title: 'No recent items', sub: 'Items you open show up here, most recent first.' },
    random: { icon: 'shuffle', title: 'Nothing to shuffle', sub: 'Add some items to the library first.' },
    alltags: { icon: 'tag', title: 'No tags', sub: '' },
    trash: { icon: 'trash', title: 'Trash is empty', sub: 'Deleted items land here until you empty the trash.' }
  }[$view])

  let containerWidth = $state(0)
  let dragging = $state(false)
  let importing = $state(false)
  let dragDepth = 0
  let draggingId = $state<string | null>(null)
  let dragOverId = $state<string | null>(null)
  let internalDrag = false

  let wrapEl = $state<HTMLElement | null>(null)
  let scrollTop = $state(0)
  let viewHeight = $state(0)

  const colCount = $derived(Math.max(1, Math.floor((containerWidth + GAP) / ($thumbSize + GAP))))
  const metaH = $derived(
    $showName || $showItemInfo ? META_PAD + ($showName ? NAME_H : 0) + ($showItemInfo ? INFO_H : 0) : 0
  )

  // ----- virtualized layout -----
  // Every layout is computed as absolute boxes (canvas coordinates); only the boxes
  // near the viewport are rendered, so the DOM stays small however big the library is.
  interface Box {
    it: RakItem
    x: number
    y: number
    w: number
    h: number // whole card, label included
    th: number // thumbnail height
  }

  const grid = $derived.by((): { boxes: Box[]; height: number } => {
    const W = containerWidth
    const items = $displayed
    if (!W || !items.length) return { boxes: [], height: 0 }
    const boxes: Box[] = new Array(items.length)
    let height = 0

    if ($layout === 'waterfall') {
      const n = colCount
      const cw = $thumbSize
      const x0 = Math.max(0, (W - (n * cw + (n - 1) * GAP)) / 2)
      const heights: number[] = new Array(n).fill(0)
      items.forEach((it, i) => {
        let min = 0
        for (let c = 1; c < n; c++) if (heights[c] < heights[min]) min = c
        const th = cw / aspect(it)
        boxes[i] = { it, x: x0 + min * (cw + GAP), y: heights[min], w: cw, h: th + metaH, th }
        heights[min] += th + metaH + GAP
      })
      height = Math.max(...heights) - GAP
    } else if ($layout === 'justified') {
      const targetH = Math.max(120, $thumbSize * 0.72)
      let y = 0
      let start = 0
      let arSum = 0
      const flush = (end: number, h: number): void => {
        let x = 0
        for (let i = start; i < end; i++) {
          const w = h * aspect(items[i])
          boxes[i] = { it: items[i], x, y, w, h, th: h }
          x += w + GAP
        }
        y += h + GAP
        start = end
        arSum = 0
      }
      items.forEach((it, i) => {
        arSum += aspect(it)
        const count = i - start + 1
        if (arSum * targetH + GAP * (count - 1) >= W) flush(i + 1, (W - GAP * (count - 1)) / arSum)
      })
      if (start < items.length) flush(items.length, targetH)
      height = y - GAP
    } else if ($layout === 'grid') {
      const n = colCount
      const cw = (W - GAP * (n - 1)) / n
      const h = cw + metaH
      items.forEach((it, i) => {
        boxes[i] = { it, x: (i % n) * (cw + GAP), y: Math.floor(i / n) * (h + GAP), w: cw, h, th: cw }
      })
      height = Math.ceil(items.length / n) * (h + GAP) - GAP
    } else {
      items.forEach((it, i) => {
        boxes[i] = { it, x: 0, y: i * (LIST_ROW_H + LIST_GAP), w: W, h: LIST_ROW_H, th: LIST_ROW_H }
      })
      height = items.length * (LIST_ROW_H + LIST_GAP) - LIST_GAP
    }
    return { boxes, height }
  })

  const visible = $derived.by(() => {
    const top = scrollTop - PAD - OVERSCAN
    const bottom = scrollTop - PAD + viewHeight + OVERSCAN
    return grid.boxes.filter((b) => b.y + b.h >= top && b.y <= bottom)
  })

  let scrollFrame = 0
  function onScroll() {
    if (scrollFrame) return
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0
      if (wrapEl) scrollTop = wrapEl.scrollTop
    })
  }

  // Keep the selected item on screen (e.g. when the arrow keys move past the edge).
  // Only a selection change triggers this, never a relayout or a resize.
  $effect(() => {
    const id = $selectedId
    untrack(() => {
      if (!id || !wrapEl) return
      const b = grid.boxes.find((x) => x.it.id === id)
      if (!b) return
      const top = b.y + PAD
      const bottom = top + b.h
      const st = wrapEl.scrollTop
      if (top < st + PAD) wrapEl.scrollTop = top - PAD
      else if (bottom > st + wrapEl.clientHeight - PAD) wrapEl.scrollTop = bottom - wrapEl.clientHeight + PAD
    })
  })

  function aspect(it: RakItem): number {
    return it.width && it.height ? it.width / it.height : 4 / 3
  }
  function fmtSize(b: number): string {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`
    return `${(b / 1024 / 1024).toFixed(1)} MB`
  }
  function fmtDate(iso: string): string {
    return new Date(iso).toLocaleDateString()
  }
  function nameText(it: RakItem): string {
    return $showExtension ? `${it.name}.${it.ext}` : it.name
  }
  function infoText(it: RakItem): string {
    switch ($itemInfoField) {
      case 'size':
        return fmtSize(it.size)
      case 'dateAdded':
        return fmtDate(it.importedAt)
      case 'extension':
        return it.ext.toUpperCase()
      default:
        // Fonts, audio and text have no pixel size: show the file size instead.
        return it.width ? `${it.width} × ${it.height}` : fmtSize(it.size)
    }
  }

  function select(id: string) {
    selectedId.set(id)
  }
  function open(id: string) {
    openId.set(id)
  }
  const fileIcon = kindIcon

  // ----- external file-drop import -----
  function onDragEnter(e: DragEvent) {
    if (internalDrag) return
    e.preventDefault()
    dragDepth++
    dragging = true
  }
  function onDragLeave(e: DragEvent) {
    if (internalDrag) return
    e.preventDefault()
    dragDepth--
    if (dragDepth <= 0) {
      dragDepth = 0
      dragging = false
    }
  }
  function onDragOver(e: DragEvent) {
    if (internalDrag) return
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }
  async function onDrop(e: DragEvent) {
    if (internalDrag) return
    e.preventDefault()
    dragging = false
    dragDepth = 0
    if ($view === 'trash') return
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (!files.length) return
    const paths = files.map((f) => window.rak.getPathForFile(f)).filter(Boolean)
    if (!paths.length) return
    importing = true
    try {
      addItems(await window.rak.importPaths(paths))
    } finally {
      importing = false
    }
  }

  // ----- internal drag-to-reorder -----
  function onCardDragStart(e: DragEvent, id: string) {
    internalDrag = true
    draggingId = id
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
    }
  }
  function onCardDragOver(e: DragEvent, id: string) {
    if (!draggingId) return
    e.preventDefault()
    e.stopPropagation()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    dragOverId = id
  }
  function onCardDrop(e: DragEvent, targetId: string) {
    if (!draggingId) return
    e.preventDefault()
    e.stopPropagation()
    const dragged = draggingId
    if (dragged !== targetId) {
      const ids = $displayed.map((it) => it.id)
      const from = ids.indexOf(dragged)
      if (from >= 0) ids.splice(from, 1)
      const to = ids.indexOf(targetId)
      ids.splice(to < 0 ? ids.length : to, 0, dragged)
      applyOrder(ids)
    }
    endCardDrag()
  }
  function endCardDrag() {
    draggingId = null
    dragOverId = null
    setTimeout(() => (internalDrag = false), 0)
  }
</script>

{#snippet thumbInner(it: RakItem)}
  {#if it.thumbnail}
    <img src={`asset://thumb/${it.id}?v=${$cacheBust}`} alt={it.name} loading="lazy" />
    {#if it.kind === 'video' || it.kind === 'audio'}<span class="playbadge"><Icon name="play" size={16} /></span>{/if}
  {:else}
    <div class="filethumb"><Icon name={fileIcon(it.kind)} size={30} strokeWidth={1.5} /><span>{it.ext}</span></div>
  {/if}
  {#if $showExtensionLabel}<span class="extlabel">{it.ext}</span>{/if}
{/snippet}

{#snippet meta(it: RakItem)}
  {#if $showName || $showItemInfo}
    <div class="meta">
      {#if $showName}<div class="name" title={nameText(it)}>{nameText(it)}</div>{/if}
      {#if $showItemInfo}<div class="info">{infoText(it)}</div>{/if}
    </div>
  {/if}
{/snippet}

<section
  class="grid-wrap"
  class:drag-active={dragging}
  bind:this={wrapEl}
  bind:clientHeight={viewHeight}
  onscroll={onScroll}
  ondragenter={onDragEnter}
  ondragleave={onDragLeave}
  ondragover={onDragOver}
  ondrop={onDrop}
  aria-label="Asset grid"
>
  {#if $displayed.length === 0}
    <div class="empty">
      <div class="empty-ico"><Icon name={empty.icon} size={44} strokeWidth={1.5} /></div>
      <p class="empty-title">{empty.title}</p>
      {#if empty.sub}<p class="empty-sub">{empty.sub}</p>{/if}
    </div>
  {:else}
    <div class="canvas" bind:clientWidth={containerWidth} style="height:{grid.height}px">
      {#each visible as b (b.it.id)}
        {@const it = b.it}
        {#if $layout === 'list'}
          <button
            class="lrow cell"
            class:selected={$selectedId === it.id}
            style="left:{b.x}px; top:{b.y}px; width:{b.w}px; height:{b.h}px"
            onclick={() => select(it.id)}
            ondblclick={() => open(it.id)}
          >
            <span class="lthumb">
              {#if it.thumbnail}
                <img src={`asset://thumb/${it.id}?v=${$cacheBust}`} alt={it.name} loading="lazy" />
              {:else}
                <span class="lfile"><Icon name={fileIcon(it.kind)} size={16} /></span>
              {/if}
            </span>
            <span class="lname">{nameText(it)}</span>
            <span class="ldim">{it.width ? `${it.width} × ${it.height}` : '—'}</span>
            <span class="lsize">{fmtSize(it.size)}</span>
            <span class="ldate">{fmtDate(it.importedAt)}</span>
          </button>
        {:else}
          <button
            class="card cell"
            class:selected={$selectedId === it.id}
            class:dragging={draggingId === it.id}
            class:drop-target={dragOverId === it.id && draggingId !== it.id}
            draggable={reorderable}
            style="left:{b.x}px; top:{b.y}px; width:{b.w}px; height:{b.h}px"
            onclick={() => select(it.id)}
            ondblclick={() => open(it.id)}
            ondragstart={(e) => onCardDragStart(e, it.id)}
            ondragover={(e) => onCardDragOver(e, it.id)}
            ondrop={(e) => onCardDrop(e, it.id)}
            ondragend={endCardDrag}
          >
            <div class="thumb" style="height:{b.th}px">{@render thumbInner(it)}</div>
            {#if $layout !== 'justified'}{@render meta(it)}{/if}
          </button>
        {/if}
      {/each}
    </div>
  {/if}

  {#if dragging || importing}
    <div class="overlay">
      <div class="overlay-box">{importing ? 'Importing…' : 'Drop images to import'}</div>
    </div>
  {/if}
</section>

<style>
  .grid-wrap {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px;
  }
  .canvas {
    position: relative;
    width: 100%;
  }
  .cell {
    position: absolute;
  }

  /* list */
  .lrow {
    display: grid;
    grid-template-columns: 52px 1fr 110px 90px 110px;
    align-items: center;
    gap: 12px;
    padding: 6px 10px;
    background: transparent;
    border: none;
    border-radius: 8px;
    text-align: left;
    color: var(--text);
  }
  .lrow:hover {
    background: var(--bg-elev);
  }
  .lrow.selected {
    background: var(--accent-soft);
  }
  .lthumb {
    width: 52px;
    height: 38px;
    border-radius: 5px;
    overflow: hidden;
    background: var(--bg-elev);
    border: 1px solid var(--border);
  }
  .lthumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .lname {
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ldim,
  .lsize,
  .ldate {
    font-size: 12px;
    color: var(--text-faint);
    font-variant-numeric: tabular-nums;
  }

  /* shared card */
  .card {
    display: block;
    width: 100%;
    padding: 0;
    background: transparent;
    border: none;
    text-align: left;
    border-radius: var(--radius);
  }
  .thumb {
    position: relative;
    width: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    background: var(--bg-elev);
    border: 1px solid var(--border);
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .playbadge {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    backdrop-filter: blur(2px);
    pointer-events: none;
  }
  .filethumb {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    color: var(--text-dim);
    background: linear-gradient(160deg, #2a2a32, #202026);
  }
  .filethumb span {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-faint);
  }
  .lfile {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--text-dim);
  }
  .extlabel {
    position: absolute;
    left: 6px;
    bottom: 6px;
    padding: 1px 5px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 4px;
    backdrop-filter: blur(2px);
  }
  .card:hover .thumb {
    border-color: #4a4a54;
  }
  .card.selected .thumb {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft);
  }
  .card.dragging {
    opacity: 0.4;
  }
  .card.drop-target .thumb {
    border-color: var(--accent);
    box-shadow: -4px 0 0 0 var(--accent);
  }

  .meta {
    padding: 6px 4px 2px;
  }
  .name {
    font-size: 12px;
    line-height: 16px; /* two lines = NAME_H */
    max-height: 32px;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    word-break: break-word;
  }
  .info {
    color: var(--text-faint);
    font-size: 11px;
    line-height: 14px; /* + margin = INFO_H */
    margin-top: 2px;
  }

  .empty {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 6px;
    color: var(--text-dim);
  }
  .empty-ico {
    opacity: 0.7;
  }
  .empty-title {
    margin: 6px 0 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
  }
  .empty-sub {
    margin: 0;
    font-size: 12px;
  }

  .overlay {
    position: absolute;
    inset: 0;
    background: rgba(20, 20, 26, 0.55);
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .drag-active .overlay {
    outline: 2px dashed var(--accent);
    outline-offset: -12px;
  }
  .overlay-box {
    padding: 14px 22px;
    background: var(--accent);
    color: #fff;
    font-weight: 700;
    border-radius: 10px;
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
  }
</style>
