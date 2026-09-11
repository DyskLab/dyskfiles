<script lang="ts">
  import {
    items,
    filters,
    activeFilterCount,
    emptyFilters,
    folders,
    allTags,
    paletteColors,
    type Shape
  } from '../lib/store'
  import Icon from './Icon.svelte'

  let openKey = $state<string | null>(null)
  let popPos = $state({ top: 0, left: 0 })
  let popEl = $state<HTMLElement>()
  let rootEl: HTMLElement

  function toggleCrit(e: MouseEvent, key: string) {
    if (openKey === key) {
      openKey = null
      return
    }
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    popPos = { top: r.bottom + 6, left: r.left }
    openKey = key
  }

  // Keep the popover fully inside the viewport (no clipping / overflow).
  $effect(() => {
    if (!openKey || !popEl) return
    const r = popEl.getBoundingClientRect()
    let { top, left } = popPos
    if (left + r.width > window.innerWidth - 12) left = window.innerWidth - r.width - 12
    if (left < 12) left = 12
    if (top + r.height > window.innerHeight - 12) top = Math.max(12, window.innerHeight - r.height - 12)
    if (top !== popPos.top || left !== popPos.left) popPos = { top, left }
  })

  const SHAPES: { key: Shape; label: string }[] = [
    { key: 'any', label: 'Any' },
    { key: 'landscape', label: 'Landscape' },
    { key: 'portrait', label: 'Portrait' },
    { key: 'square', label: 'Square' }
  ]
  const CRITS: { key: string; icon: string; label: string }[] = [
    { key: 'color', icon: 'droplet', label: 'Color' },
    { key: 'tags', icon: 'tag', label: 'Tags' },
    { key: 'folder', icon: 'folder', label: 'Folder' },
    { key: 'shape', icon: 'shapes', label: 'Shape' },
    { key: 'rating', icon: 'star', label: 'Rating' },
    { key: 'types', icon: 'type', label: 'Types' },
    { key: 'dimensions', icon: 'ruler', label: 'Dimensions' },
    { key: 'duration', icon: 'clock', label: 'Duration' },
    { key: 'size', icon: 'hard-drive', label: 'Size' },
    { key: 'comment', icon: 'message', label: 'Comment' },
    { key: 'note', icon: 'note', label: 'Note' },
    { key: 'url', icon: 'link', label: 'URL' },
    { key: 'dateAdded', icon: 'calendar', label: 'Date Added' },
    { key: 'dateModified', icon: 'calendar', label: 'Date Modified' }
  ]

  const exts = $derived([...new Set($items.map((it) => it.ext))].sort())
  const MB = 1024 * 1024

  function onWindowClick(e: MouseEvent) {
    if (rootEl && !rootEl.contains(e.target as Node)) openKey = null
  }
  $effect(() => {
    if (openKey) {
      window.addEventListener('click', onWindowClick, true)
      return () => window.removeEventListener('click', onWindowClick, true)
    }
    return
  })

  function isActive(key: string, f = $filters): boolean {
    switch (key) {
      case 'types': return f.types.length > 0
      case 'color': return !!f.color
      case 'tags': return f.tags.length > 0
      case 'folder': return !!f.folderId
      case 'shape': return f.shape !== 'any'
      case 'rating': return f.ratingMin > 0
      case 'dimensions': return f.minWidth != null || f.minHeight != null
      case 'size': return f.sizeMin != null || f.sizeMax != null
      case 'duration': return f.durationMin != null || f.durationMax != null
      case 'comment': return f.comment.trim().length > 0
      case 'note': return f.note.trim().length > 0
      case 'url': return f.url.trim().length > 0
      case 'dateAdded': return !!(f.dateAddedFrom || f.dateAddedTo)
      case 'dateModified': return !!(f.dateModifiedFrom || f.dateModifiedTo)
      default: return false
    }
  }
  function clearCriterion(e: MouseEvent, key: string) {
    e.stopPropagation()
    filters.update((f) => {
      const n = { ...f }
      switch (key) {
        case 'types': n.types = []; break
        case 'color': n.color = null; break
        case 'tags': n.tags = []; break
        case 'folder': n.folderId = null; break
        case 'shape': n.shape = 'any'; break
        case 'rating': n.ratingMin = 0; break
        case 'dimensions': n.minWidth = null; n.minHeight = null; break
        case 'size': n.sizeMin = null; n.sizeMax = null; break
        case 'duration': n.durationMin = null; n.durationMax = null; break
        case 'comment': n.comment = ''; break
        case 'note': n.note = ''; break
        case 'url': n.url = ''; break
        case 'dateAdded': n.dateAddedFrom = null; n.dateAddedTo = null; break
        case 'dateModified': n.dateModifiedFrom = null; n.dateModifiedTo = null; break
      }
      return n
    })
  }
  function toggleType(ext: string) {
    filters.update((f) => ({ ...f, types: f.types.includes(ext) ? f.types.filter((e) => e !== ext) : [...f.types, ext] }))
  }
  function toggleTag(t: string) {
    filters.update((f) => ({ ...f, tags: f.tags.includes(t) ? f.tags.filter((x) => x !== t) : [...f.tags, t] }))
  }
  const num = (v: string): number | null => (isNaN(parseInt(v, 10)) ? null : parseInt(v, 10))
  const mb = (v: string): number | null => (isNaN(parseFloat(v)) ? null : Math.round(parseFloat(v) * MB))
</script>

<div class="filterbar" bind:this={rootEl}>
  <div class="filters">
    {#each CRITS as c (c.key)}
      <div class="critwrap">
        <button class="chip" class:on={isActive(c.key)} onclick={(e) => toggleCrit(e, c.key)}>
          <Icon name={c.icon} size={13} />
          <span>{c.label}</span>
          {#if isActive(c.key)}
            <span class="x" role="button" tabindex="0" onclick={(e) => clearCriterion(e, c.key)} onkeydown={() => {}}><Icon name="x" size={11} /></span>
          {:else}
            <Icon name="chevron" size={11} />
          {/if}
        </button>
        {#if openKey === c.key}
          <div class="pop" bind:this={popEl} style="top:{popPos.top}px; left:{popPos.left}px">
            {#if c.key === 'types'}
              {#if exts.length === 0}<div class="hint">No items</div>{:else}
                <div class="chips">{#each exts as ext (ext)}<button class="pchip" class:sel={$filters.types.includes(ext)} onclick={() => toggleType(ext)}>{ext.toUpperCase()}</button>{/each}</div>
              {/if}
            {:else if c.key === 'color'}
              {#if $paletteColors.length === 0}<div class="hint">No colors</div>{:else}
                <div class="swatches">{#each $paletteColors as col (col)}<button class="sw" class:sel={$filters.color === col} style="background:{col}" title={col} aria-label={col} onclick={() => filters.update((f) => ({ ...f, color: f.color === col ? null : col }))}></button>{/each}</div>
              {/if}
            {:else if c.key === 'tags'}
              {#if $allTags.length === 0}<div class="hint">No tags</div>{:else}
                <div class="chips">{#each $allTags as t (t)}<button class="pchip" class:sel={$filters.tags.includes(t)} onclick={() => toggleTag(t)}>{t}</button>{/each}</div>
              {/if}
            {:else if c.key === 'folder'}
              {#if $folders.length === 0}<div class="hint">No folders</div>{:else}
                <select class="in" value={$filters.folderId ?? ''} onchange={(e) => filters.update((f) => ({ ...f, folderId: e.currentTarget.value || null }))}>
                  <option value="">Any folder</option>{#each $folders as fo (fo.id)}<option value={fo.id}>{fo.name}</option>{/each}
                </select>
              {/if}
            {:else if c.key === 'shape'}
              <div class="seg">{#each SHAPES as s (s.key)}<button class:on={$filters.shape === s.key} onclick={() => filters.update((f) => ({ ...f, shape: s.key }))}>{s.label}</button>{/each}</div>
            {:else if c.key === 'rating'}
              <div class="stars">{#each [1, 2, 3, 4, 5] as n}<button class="star" class:on={$filters.ratingMin >= n} onclick={() => filters.update((f) => ({ ...f, ratingMin: f.ratingMin === n ? 0 : n }))}><Icon name="star" size={16} /></button>{/each}</div>
            {:else if c.key === 'dimensions'}
              <div class="fields"><label>Min W<input type="number" value={$filters.minWidth ?? ''} oninput={(e) => filters.update((f) => ({ ...f, minWidth: num(e.currentTarget.value) }))} /></label><label>Min H<input type="number" value={$filters.minHeight ?? ''} oninput={(e) => filters.update((f) => ({ ...f, minHeight: num(e.currentTarget.value) }))} /></label></div>
            {:else if c.key === 'size'}
              <div class="fields"><label>Min MB<input type="number" step="0.1" value={$filters.sizeMin != null ? ($filters.sizeMin / MB).toFixed(1) : ''} oninput={(e) => filters.update((f) => ({ ...f, sizeMin: mb(e.currentTarget.value) }))} /></label><label>Max MB<input type="number" step="0.1" value={$filters.sizeMax != null ? ($filters.sizeMax / MB).toFixed(1) : ''} oninput={(e) => filters.update((f) => ({ ...f, sizeMax: mb(e.currentTarget.value) }))} /></label></div>
            {:else if c.key === 'duration'}
              <div class="fields"><label>Min s<input type="number" value={$filters.durationMin ?? ''} oninput={(e) => filters.update((f) => ({ ...f, durationMin: num(e.currentTarget.value) }))} /></label><label>Max s<input type="number" value={$filters.durationMax ?? ''} oninput={(e) => filters.update((f) => ({ ...f, durationMax: num(e.currentTarget.value) }))} /></label></div>
            {:else if c.key === 'comment'}
              <input class="in" value={$filters.comment} placeholder="Contains…" oninput={(e) => filters.update((f) => ({ ...f, comment: e.currentTarget.value }))} />
            {:else if c.key === 'note'}
              <input class="in" value={$filters.note} placeholder="Contains…" oninput={(e) => filters.update((f) => ({ ...f, note: e.currentTarget.value }))} />
            {:else if c.key === 'url'}
              <input class="in" value={$filters.url} placeholder="Contains…" oninput={(e) => filters.update((f) => ({ ...f, url: e.currentTarget.value }))} />
            {:else if c.key === 'dateAdded'}
              <div class="fields"><label>From<input type="date" value={$filters.dateAddedFrom ?? ''} oninput={(e) => filters.update((f) => ({ ...f, dateAddedFrom: e.currentTarget.value || null }))} /></label><label>To<input type="date" value={$filters.dateAddedTo ?? ''} oninput={(e) => filters.update((f) => ({ ...f, dateAddedTo: e.currentTarget.value || null }))} /></label></div>
            {:else if c.key === 'dateModified'}
              <div class="fields"><label>From<input type="date" value={$filters.dateModifiedFrom ?? ''} oninput={(e) => filters.update((f) => ({ ...f, dateModifiedFrom: e.currentTarget.value || null }))} /></label><label>To<input type="date" value={$filters.dateModifiedTo ?? ''} oninput={(e) => filters.update((f) => ({ ...f, dateModifiedTo: e.currentTarget.value || null }))} /></label></div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
    {#if $activeFilterCount}
      <button class="clearall" onclick={() => filters.set(emptyFilters())}>Clear all</button>
    {/if}
  </div>
</div>

<style>
  .filterbar {
    display: flex;
    align-items: center;
    padding: 7px 14px;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .filters {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .filters::-webkit-scrollbar {
    height: 0;
  }
  .critwrap {
    position: relative;
    flex-shrink: 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 5px 8px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-dim);
    font-size: 12px;
    white-space: nowrap;
  }
  .chip:hover {
    color: var(--text);
  }
  .chip.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: #cfe0ff;
  }
  .chip .x {
    display: flex;
    align-items: center;
    border-radius: 50%;
    padding: 1px;
  }
  .chip .x:hover {
    background: rgba(255, 255, 255, 0.2);
  }
  .clearall {
    flex-shrink: 0;
    background: transparent;
    border: none;
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    padding: 4px 6px;
  }
  .clearall:hover {
    text-decoration: underline;
  }

  .pop {
    position: fixed;
    z-index: 70;
    min-width: 180px;
    max-width: min(340px, 90vw);
    max-height: 60vh;
    overflow-y: auto;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px;
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.5);
  }
  .hint {
    color: var(--text-faint);
    font-size: 12px;
    font-style: italic;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 300px;
  }
  .pchip {
    padding: 4px 9px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
  }
  .pchip.sel {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: #cfe0ff;
  }
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    max-width: 200px;
  }
  .sw {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 2px solid transparent;
  }
  .sw.sel {
    border-color: var(--text);
  }
  .in {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text);
    padding: 6px 8px;
    outline: none;
    font-size: 12px;
  }
  .seg {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .seg button {
    padding: 5px 10px;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
  }
  .seg button.on {
    background: var(--accent-soft);
    border-color: var(--accent);
    color: #cfe0ff;
  }
  .stars {
    display: flex;
    gap: 3px;
  }
  .star {
    background: transparent;
    border: none;
    color: #4a4a54;
    padding: 2px;
  }
  .star.on {
    color: #f6b03c;
  }
  .fields {
    display: flex;
    gap: 8px;
  }
  .fields label {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--text-faint);
  }
  .fields input {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 7px;
    color: var(--text);
    padding: 6px 8px;
    outline: none;
    font-size: 12px;
  }
</style>
