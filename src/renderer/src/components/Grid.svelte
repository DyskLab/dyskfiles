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

  const GAP = 14
  const LABEL_H = 48

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

  const colCount = $derived(Math.max(1, Math.floor((containerWidth + GAP) / ($thumbSize + GAP))))

  // ----- waterfall (masonry) -----
  const columns = $derived.by(() => {
    const n = colCount
    const heights: number[] = new Array(n).fill(0)
    const buckets: RakItem[][] = Array.from({ length: n }, () => [])
    for (const it of $displayed) {
      let min = 0
      for (let i = 1; i < n; i++) if (heights[i] < heights[min]) min = i
      buckets[min].push(it)
      const ratio = it.width && it.height ? it.height / it.width : 0.75
      heights[min] += $thumbSize * ratio + LABEL_H + GAP
    }
    return buckets
  })

  // ----- justified rows -----
  const jrows = $derived.by(() => {
    const targetH = Math.max(120, $thumbSize * 0.72)
    const W = containerWidth || 1
    const rows: { items: RakItem[]; h: number }[] = []
    let row: RakItem[] = []
    let arSum = 0
    for (const it of $displayed) {
      const a = it.width && it.height ? it.width / it.height : 4 / 3
      row.push(it)
      arSum += a
      const rowW = arSum * targetH + GAP * (row.length - 1)
      if (rowW >= W) {
        rows.push({ items: row, h: (W - GAP * (row.length - 1)) / arSum })
        row = []
        arSum = 0
      }
    }
    if (row.length) rows.push({ items: row, h: targetH })
    return rows
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
        return `${it.width} × ${it.height}`
    }
  }

  function select(id: string) {
    selectedId.set(id)
  }
  function open(id: string) {
    openId.set(id)
  }
  function fileIcon(kind: string): string {
    return kind === 'video' ? 'film' : kind === 'audio' ? 'music' : 'note'
  }

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

{#snippet thumb(it: RakItem, rounded = true)}
  <div class="thumb" class:rounded style="aspect-ratio:{it.width && it.height ? `${it.width}/${it.height}` : '4/3'}">
    {#if it.thumbnail}
      <img src={`asset://thumb/${it.id}?v=${$cacheBust}`} alt={it.name} loading="lazy" />
      {#if it.kind === 'video' || it.kind === 'audio'}
        <span class="playbadge"><Icon name="play" size={16} /></span>
      {/if}
    {:else}
      <div class="filethumb"><Icon name={fileIcon(it.kind)} size={30} strokeWidth={1.5} /><span>{it.ext}</span></div>
    {/if}
    {#if $showExtensionLabel}<span class="extlabel">{it.ext}</span>{/if}
  </div>
{/snippet}

{#snippet meta(it: RakItem)}
  {#if $showName || $showItemInfo}
    <div class="meta">
      {#if $showName}<div class="name" title={nameText(it)}>{nameText(it)}</div>{/if}
      {#if $showItemInfo}<div class="info">{infoText(it)}</div>{/if}
    </div>
  {/if}
{/snippet}

{#snippet card(it: RakItem)}
  <button
    class="card"
    class:selected={$selectedId === it.id}
    class:dragging={draggingId === it.id}
    class:drop-target={dragOverId === it.id && draggingId !== it.id}
    draggable={reorderable}
    onclick={() => select(it.id)}
    ondblclick={() => open(it.id)}
    ondragstart={(e) => onCardDragStart(e, it.id)}
    ondragover={(e) => onCardDragOver(e, it.id)}
    ondrop={(e) => onCardDrop(e, it.id)}
    ondragend={endCardDrag}
  >
    {@render thumb(it)}
    {@render meta(it)}
  </button>
{/snippet}

<section
  class="grid-wrap"
  class:drag-active={dragging}
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
    <div class="canvas" bind:clientWidth={containerWidth}>
      {#if $layout === 'waterfall'}
        <div class="masonry" style="gap:{GAP}px">
          {#each columns as col}
            <div class="col" style="width:{$thumbSize}px; gap:{GAP}px">
              {#each col as it (it.id)}{@render card(it)}{/each}
            </div>
          {/each}
        </div>
      {:else if $layout === 'justified'}
        <div class="justified" style="gap:{GAP}px">
          {#each jrows as r}
            <div class="jrow" style="gap:{GAP}px; height:{r.h}px">
              {#each r.items as it (it.id)}
                <button
                  class="card jcard"
                  class:selected={$selectedId === it.id}
                  class:dragging={draggingId === it.id}
                  class:drop-target={dragOverId === it.id && draggingId !== it.id}
                  draggable={reorderable}
                  style="width:{r.h * aspect(it)}px"
                  onclick={() => select(it.id)}
                  ondblclick={() => open(it.id)}
                  ondragstart={(e) => onCardDragStart(e, it.id)}
                  ondragover={(e) => onCardDragOver(e, it.id)}
                  ondrop={(e) => onCardDrop(e, it.id)}
                  ondragend={endCardDrag}
                >
                  <div class="thumb jthumb">
                    {#if it.thumbnail}
                      <img src={`asset://thumb/${it.id}?v=${$cacheBust}`} alt={it.name} loading="lazy" />
                      {#if it.kind === 'video' || it.kind === 'audio'}<span class="playbadge"><Icon name="play" size={16} /></span>{/if}
                    {:else}
                      <div class="filethumb"><Icon name={fileIcon(it.kind)} size={30} strokeWidth={1.5} /><span>{it.ext}</span></div>
                    {/if}
                    {#if $showExtensionLabel}<span class="extlabel">{it.ext}</span>{/if}
                  </div>
                </button>
              {/each}
            </div>
          {/each}
        </div>
      {:else if $layout === 'grid'}
        <div class="uni" style="grid-template-columns:repeat(auto-fill,minmax({$thumbSize}px,1fr)); gap:{GAP}px">
          {#each $displayed as it (it.id)}
            <button
              class="card"
              class:selected={$selectedId === it.id}
              class:dragging={draggingId === it.id}
              class:drop-target={dragOverId === it.id && draggingId !== it.id}
              draggable={reorderable}
              onclick={() => select(it.id)}
              ondblclick={() => open(it.id)}
              ondragstart={(e) => onCardDragStart(e, it.id)}
              ondragover={(e) => onCardDragOver(e, it.id)}
              ondrop={(e) => onCardDrop(e, it.id)}
              ondragend={endCardDrag}
            >
              <div class="thumb rounded square">
                {#if it.thumbnail}
                  <img src={`asset://thumb/${it.id}?v=${$cacheBust}`} alt={it.name} loading="lazy" />
                  {#if it.kind === 'video' || it.kind === 'audio'}<span class="playbadge"><Icon name="play" size={16} /></span>{/if}
                {:else}
                  <div class="filethumb"><Icon name={fileIcon(it.kind)} size={30} strokeWidth={1.5} /><span>{it.ext}</span></div>
                {/if}
                {#if $showExtensionLabel}<span class="extlabel">{it.ext}</span>{/if}
              </div>
              {@render meta(it)}
            </button>
          {/each}
        </div>
      {:else}
        <div class="list">
          {#each $displayed as it (it.id)}
            <button
              class="lrow"
              class:selected={$selectedId === it.id}
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
              <span class="ldim">{it.width} × {it.height}</span>
              <span class="lsize">{fmtSize(it.size)}</span>
              <span class="ldate">{fmtDate(it.importedAt)}</span>
            </button>
          {/each}
        </div>
      {/if}
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
    width: 100%;
  }

  /* waterfall */
  .masonry {
    display: flex;
    justify-content: center;
    align-items: flex-start;
  }
  .col {
    display: flex;
    flex-direction: column;
  }

  /* justified */
  .justified {
    display: flex;
    flex-direction: column;
  }
  .jrow {
    display: flex;
  }
  .jcard {
    height: 100%;
    flex-shrink: 0;
  }
  .jthumb {
    height: 100%;
    aspect-ratio: auto !important;
  }

  /* uniform grid */
  .uni {
    display: grid;
  }

  /* list */
  .list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
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
  .thumb.square {
    aspect-ratio: 1 / 1 !important;
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
    line-height: 1.35;
    max-height: 2.7em;
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
