<script lang="ts">
  import { revealLabel } from '../lib/platform'
  import {
    displayed,
    selectedId,
    openId,
    folders,
    inspectorPinned,
    trashItem,
    restoreItem,
    deleteForever,
    updateItemMeta,
    openExternally,
    addFolder,
    cacheBust,
    hexToRgb
  } from '../lib/store'
  import { tooltip } from '../lib/tooltip'
  import Icon from './Icon.svelte'
  import { kindIcon } from '../lib/kind'

  const item = $derived($displayed.find((it) => it.id === $selectedId) ?? null)
  const trashed = $derived(!!item?.deletedAt)

  // Percent coverage of each palette colour, sampled from the item's thumbnail.
  let colorPct = $state<Record<string, number>>({})

  async function computePalettePct(id: string, hexes: string[]): Promise<void> {
    const rgbs = hexes.map((h) => hexToRgb(h))
    if (rgbs.some((r) => !r)) return
    try {
      const resp = await fetch(`asset://thumb/${id}`)
      const bmp = await createImageBitmap(await resp.blob())
      const w = Math.min(64, bmp.width)
      const h = Math.max(1, Math.round((w * bmp.height) / bmp.width))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(bmp, 0, 0, w, h)
      bmp.close()
      const data = ctx.getImageData(0, 0, w, h).data
      const counts = new Array(hexes.length).fill(0)
      let total = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] < 8) continue // skip transparent
        const r = data[i], g = data[i + 1], b = data[i + 2]
        let best = 0
        let bestD = Infinity
        for (let k = 0; k < rgbs.length; k++) {
          const c = rgbs[k] as [number, number, number]
          const d = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2
          if (d < bestD) {
            bestD = d
            best = k
          }
        }
        counts[best]++
        total++
      }
      if (!total) return
      if (item?.id !== id) return // selection changed while sampling
      const pct: Record<string, number> = {}
      hexes.forEach((hex, k) => (pct[hex] = Math.round((counts[k] / total) * 100)))
      colorPct = pct
    } catch {
      colorPct = {}
    }
  }

  $effect(() => {
    const it = item
    colorPct = {}
    if (it?.colors?.length) computePalettePct(it.id, it.colors)
  })

  let tagInput = $state('')
  let addingTag = $state(false)
  let pickingFolder = $state(false)
  let newFolderName = $state('')

  function fmtSize(b: number): string {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / 1024 / 1024).toFixed(2)} MB`
  }
  function fmtDuration(s: number): string {
    const m = Math.floor(s / 60)
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`
  }
  function fmtDate(iso: string): string {
    const d = new Date(iso)
    const p = (n: number) => n.toString().padStart(2, '0')
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
  }
  function fileIcon(kind: string): string {
    return kindIcon(kind)
  }

  function setRating(n: number) {
    if (item) updateItemMeta(item.id, { rating: item.rating === n ? 0 : n })
  }
  function addTag() {
    const t = tagInput.trim()
    if (item && t && !(item.tags ?? []).includes(t)) {
      updateItemMeta(item.id, { tags: [...(item.tags ?? []), t] })
    }
    tagInput = ''
    addingTag = false
  }
  function removeTag(t: string) {
    if (item) updateItemMeta(item.id, { tags: (item.tags ?? []).filter((x) => x !== t) })
  }
  function addToFolder(id: string) {
    if (item && id && !(item.folderIds ?? []).includes(id)) {
      updateItemMeta(item.id, { folderIds: [...(item.folderIds ?? []), id] })
    }
    pickingFolder = false
  }
  function removeFromFolder(id: string) {
    if (item) updateItemMeta(item.id, { folderIds: (item.folderIds ?? []).filter((x) => x !== id) })
  }
  async function createAndAdd() {
    const name = newFolderName.trim()
    newFolderName = ''
    if (!item || !name) {
      pickingFolder = false
      return
    }
    const existing = $folders.find((f) => f.name.toLowerCase() === name.toLowerCase())
    const f = existing ?? (await addFolder(name))
    addToFolder(f.id)
  }
  const itemFolders = $derived(
    (item?.folderIds ?? [])
      .map((id) => $folders.find((f) => f.id === id))
      .filter((f): f is (typeof $folders)[number] => !!f)
  )
  const availableFolders = $derived($folders.filter((f) => !(item?.folderIds ?? []).includes(f.id)))

  function close() {
    selectedId.set(null)
  }
  function reveal() {
    if (item) window.rak.revealItem(item.id)
  }
  function exportItem() {
    if (item) window.rak.exportItem(item.id, `${item.name}.${item.ext}`)
  }
  async function trash() {
    if (item) await trashItem(item.id)
  }
  async function restore() {
    if (item) await restoreItem(item.id)
  }
  async function del() {
    if (item) await deleteForever(item.id)
  }
</script>

{#if item}
  <aside class="inspector">
    <div class="head drag">
      <button class="hbtn no-drag" class:on={$inspectorPinned} use:tooltip={{ text: 'Pin panel', placement: 'top' }} aria-label="Pin panel" onclick={() => inspectorPinned.update((v) => !v)}>
        <Icon name="pin" size={15} />
      </button>
      <button class="hbtn no-drag" onclick={close} use:tooltip={{ text: 'Close', placement: 'top' }} aria-label="Close"><Icon name="x" size={15} /></button>
    </div>

    <div class="preview">
      {#if item.kind === 'image'}
        <button class="imgbtn" onclick={() => openId.set(item.id)} title="Open">
          <span class="badge">{item.ext.toUpperCase()}</span>
          <img src={`asset://original/${item.id}`} alt={item.name} />
        </button>
      {:else if item.thumbnail && item.kind !== 'text'}
        <button class="imgbtn" onclick={() => openId.set(item.id)} title={item.kind === 'video' || item.kind === 'audio' ? 'Play' : 'Open'}>
          <span class="badge">{item.ext.toUpperCase()}</span>
          <img src={`asset://thumb/${item.id}?v=${$cacheBust}`} alt={item.name} />
          {#if item.kind === 'video' || item.kind === 'audio'}<span class="playover"><Icon name="play" size={26} /></span>{/if}
        </button>
      {:else}
        <button class="filebig" onclick={() => openId.set(item.id)}>
          <Icon name={fileIcon(item.kind)} size={40} strokeWidth={1.4} />
          <span class="ext">{item.ext.toUpperCase()}</span>
          <span class="openhint">{item.kind === 'text' ? 'Open in editor' : item.kind === 'video' || item.kind === 'audio' ? 'Play' : 'Open'}</span>
        </button>
      {/if}
    </div>

    {#if item.colors?.length}
      <div class="palette">
        {#each item.colors as c}<span
            class="pc"
            style="background:{c}"
            title={colorPct[c] != null ? `${c.toUpperCase()} · ${colorPct[c]}%` : c.toUpperCase()}
          ></span>{/each}
      </div>
    {/if}

    <div class="body">
      <input
        class="namefield"
        value={item.name}
        spellcheck="false"
        onchange={(e) => updateItemMeta(item.id, { name: e.currentTarget.value.trim() || item.name })}
      />

      {#if !trashed}
        <textarea class="field" rows="2" value={item.note ?? ''} placeholder="Notes..." onchange={(e) => updateItemMeta(item.id, { note: e.currentTarget.value })}></textarea>
        <input class="field" value={item.url ?? ''} placeholder="http://" spellcheck="false" onchange={(e) => updateItemMeta(item.id, { url: e.currentTarget.value })} />

        <div class="divider"></div>

        <div class="sec">Tags</div>
        {#if (item.tags ?? []).length}
          <div class="tags">
            {#each item.tags as t (t)}
              <span class="tag">{t}<button class="tx" onclick={() => removeTag(t)}><Icon name="x" size={11} /></button></span>
            {/each}
          </div>
        {/if}
        {#if addingTag}
          <input class="field" bind:value={tagInput} placeholder="Tag name + Enter" spellcheck="false" onkeydown={(e) => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { addingTag = false; tagInput = '' } }} />
        {:else}
          <button class="newtag" onclick={() => (addingTag = true)}><Icon name="plus" size={14} /> New tag</button>
        {/if}

        <div class="divider"></div>

        <div class="sec">Folders</div>
        {#if itemFolders.length}
          <div class="tags">
            {#each itemFolders as f (f.id)}
              <span class="fpill"><Icon name="folder" size={12} />{f.name}<button class="tx" onclick={() => removeFromFolder(f.id)}><Icon name="x" size={11} /></button></span>
            {/each}
          </div>
        {/if}
        {#if pickingFolder}
          {#if availableFolders.length}
            <div class="tags">
              {#each availableFolders as f (f.id)}
                <button class="fchip" onclick={() => addToFolder(f.id)}><Icon name="folder" size={12} /> {f.name}</button>
              {/each}
            </div>
          {/if}
          <input
            class="field"
            bind:value={newFolderName}
            placeholder="Folder name + Enter to create"
            spellcheck="false"
            onkeydown={(e) => {
              if (e.key === 'Enter') createAndAdd()
              if (e.key === 'Escape') { pickingFolder = false; newFolderName = '' }
            }}
          />
        {:else}
          <button class="newtag" onclick={() => (pickingFolder = true)}><Icon name="plus" size={14} /> Add to folder</button>
        {/if}

        <div class="divider"></div>
      {/if}

      <div class="sec">Properties</div>
      <dl class="props">
        <dt>Rating</dt>
        <dd class="stars">
          {#each [1, 2, 3, 4, 5] as n}
            <button class="star" class:on={(item.rating ?? 0) >= n} disabled={trashed} onclick={() => setRating(n)}><Icon name="star" size={15} /></button>
          {/each}
        </dd>
        {#if item.width}<dt>Dimensions</dt><dd>{item.width} × {item.height}</dd>{/if}
        {#if item.duration != null}<dt>Duration</dt><dd>{fmtDuration(item.duration)}</dd>{/if}
        <dt>Size</dt><dd>{fmtSize(item.size)}</dd>
        <dt>Type</dt><dd>{item.ext.toUpperCase()}</dd>
        <dt>Storage</dt><dd>{item.linked ? 'Linked (reference)' : 'Copied into library'}</dd>
        {#if item.linked}<dt>Source</dt><dd class="src" title={item.original}>{item.original}</dd>{/if}
        <dt>Date Imported</dt><dd>{fmtDate(item.importedAt)}</dd>
        {#if item.dateCreated}<dt>Date Created</dt><dd>{fmtDate(item.dateCreated)}</dd>{/if}
        {#if item.dateModified}<dt>Date Modified</dt><dd>{fmtDate(item.dateModified)}</dd>{/if}
      </dl>

      <div class="actions">
        {#if trashed}
          <button class="wide" onclick={restore}><Icon name="restore" size={15} /> Restore</button>
          <button class="danger" onclick={del}><Icon name="trash" size={15} /> Delete Forever</button>
        {:else}
          <button class="export" onclick={exportItem}><Icon name="reveal" size={15} /> Export</button>
          <div class="minirow">
            <button class="mini" onclick={() => openExternally(item.id)} title="Open in default app"><Icon name="app" size={14} /></button>
            <button class="mini" onclick={reveal} title={revealLabel}><Icon name="folder" size={14} /></button>
            <button class="mini danger" onclick={trash} title="Delete"><Icon name="trash" size={14} /></button>
          </div>
        {/if}
      </div>
    </div>
  </aside>
{:else}
  <aside class="inspector">
    <div class="head drag">
      <button class="hbtn no-drag on" title="Unpin panel" onclick={() => inspectorPinned.set(false)}>
        <Icon name="pin" size={15} />
      </button>
    </div>
    <div class="noselect">
      <Icon name="image" size={36} strokeWidth={1.4} />
      <p>No selection</p>
    </div>
  </aside>
{/if}

<style>
  .noselect {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    color: var(--text-faint);
    font-size: 13px;
  }
  .inspector {
    background: var(--sidebar);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    height: var(--titlebar-h);
    padding: 0 8px;
  }
  .hbtn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    margin: 10px 0;
    border: none;
    border-radius: 7px;
    background: transparent;
    color: var(--text-dim);
  }
  .hbtn:hover {
    background: var(--bg-elev);
    color: var(--text);
  }
  .hbtn.on {
    color: var(--accent);
  }

  .preview {
    padding: 0 16px;
  }
  .imgbtn {
    position: relative;
    display: block;
    width: 100%;
    padding: 0;
    background: transparent;
    border: none;
  }
  .badge {
    position: absolute;
    left: 8px;
    top: 8px;
    z-index: 1;
    padding: 2px 7px;
    font-size: 10px;
    font-weight: 700;
    color: #fff;
    background: rgba(0, 0, 0, 0.6);
    border-radius: 5px;
  }
  .playover {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    backdrop-filter: blur(2px);
    pointer-events: none;
  }
  .preview img {
    width: 100%;
    max-height: 240px;
    object-fit: contain;
    border-radius: var(--radius);
    background: var(--bg);
    border: 1px solid var(--border);
  }
  .filebig {
    width: 100%;
    height: 150px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: linear-gradient(160deg, #2a2a32, #202026);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-dim);
  }
  .filebig .ext {
    font-size: 13px;
    font-weight: 700;
    color: var(--text);
  }
  .filebig .openhint {
    font-size: 11px;
    color: var(--accent);
  }

  .palette {
    display: flex;
    align-self: center;
    margin: 16px 0 4px;
    padding: 5px;
    gap: 3px;
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 999px;
  }
  .pc {
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }

  .body {
    padding: 12px 16px 16px;
  }
  .namefield {
    width: 100%;
    font-size: 15px;
    font-weight: 600;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 9px;
    padding: 10px 12px;
    outline: none;
    margin-bottom: 8px;
  }
  .field {
    width: 100%;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 9px;
    color: var(--text);
    padding: 9px 12px;
    outline: none;
    font-size: 13px;
    font-family: inherit;
    resize: vertical;
    margin-bottom: 8px;
  }
  .namefield:focus,
  .field:focus {
    border-color: var(--accent);
  }

  .divider {
    height: 1px;
    background: var(--border);
    margin: 12px 0;
  }
  .sec {
    color: var(--text-faint);
    font-size: 13px;
    margin-bottom: 8px;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    margin-bottom: 8px;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 3px 4px 3px 9px;
    background: var(--accent-soft);
    border: 1px solid var(--accent);
    border-radius: 999px;
    color: #cfe0ff;
    font-size: 12px;
  }
  .tx {
    display: flex;
    align-items: center;
    background: transparent;
    border: none;
    color: #9dc0ff;
    padding: 1px;
    border-radius: 50%;
  }
  .tx:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .newtag {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 9px 10px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-weight: 600;
    font-size: 13px;
  }
  .newtag:hover {
    background: #34343c;
  }

  .fpill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 5px 4px 10px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text);
    font-size: 13px;
  }
  .fchip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    background: transparent;
    border: 1px dashed var(--border);
    border-radius: 8px;
    color: var(--text-dim);
    font-size: 13px;
  }
  .fchip:hover {
    color: var(--text);
    border-color: #4a4a54;
  }

  .props {
    display: grid;
    grid-template-columns: 120px 1fr;
    row-gap: 10px;
    column-gap: 8px;
    margin: 0 0 18px;
  }
  dt {
    color: var(--text);
    font-size: 13px;
  }
  dd {
    margin: 0;
    font-size: 13px;
    color: var(--text-dim);
    font-family: 'SF Mono', Menlo, Consolas, monospace;
    font-variant-numeric: tabular-nums;
    word-break: break-word;
  }
  dd.src {
    font-size: 11px;
    word-break: break-all;
    color: var(--text-faint);
  }
  dd.stars {
    display: flex;
    gap: 2px;
  }
  .star {
    background: transparent;
    border: none;
    color: #4a4a54;
    padding: 0;
  }
  .star.on {
    color: #f6b03c;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .export {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 11px;
    background: var(--bg-elev-2);
    border: 1px solid var(--border);
    border-radius: 9px;
    color: var(--text);
    font-weight: 600;
    font-size: 13px;
  }
  .export:hover {
    background: #34343c;
  }
  .minirow {
    display: flex;
    gap: 8px;
  }
  .mini {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-dim);
  }
  .mini:hover {
    background: var(--bg-elev-2);
    color: var(--text);
  }
  .danger {
    border-color: #6b2b2b;
    color: #ff8080;
  }
  .danger:hover {
    background: rgba(220, 60, 60, 0.12);
  }
  .actions .danger:not(.mini) {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 10px;
    border-radius: 9px;
    font-weight: 600;
    font-size: 13px;
    background: transparent;
  }
</style>
