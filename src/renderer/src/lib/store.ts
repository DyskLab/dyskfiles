import { derived, get, writable } from 'svelte/store'
import { fontThumbnail, pdfThumbnail, type Thumb } from './render'
import { matchTerms, parseQuery, type SearchField } from './query'

export type View = 'all' | 'uncategorized' | 'untagged' | 'recent' | 'random' | 'alltags' | 'trash'

export const library = writable<RakLibrary | null>(null)
export const libraries = writable<RakKnownLibrary[]>([])
export const items = writable<RakItem[]>([]) // active items only
export const trash = writable<RakItem[]>([])
export const view = writable<View>('all')
export const selectedId = writable<string | null>(null)
/** Item currently opened in the viewer/editor (double-click), or null. */
export const openId = writable<string | null>(null)
export const searchOpen = writable<boolean>(false)
/** Which tab the search palette opens on ('document' | 'tags' | 'folders' | 'smart'). */
export const searchTab = writable<string>('document')
export const sidebarCollapsed = writable<boolean>(false)
export const duplicatesOpen = writable<boolean>(false)
export const duplicateGroups = writable<RakItem[][]>([])
/** 'identical' = same bytes; 'similar' = thumbnails that look alike. */
export const duplicateMode = writable<'identical' | 'similar'>('identical')
export const duplicatesBusy = writable<boolean>(false)
/** Eagle import progress (null when no import is running). */
export const eagleProgress = writable<{ done: number; total: number } | null>(null)
/** Folders whose new files are imported automatically. */
export const watchedFolders = writable<string[]>([])
export const watchedOpen = writable<boolean>(false)
/** Inline quick-search query + which fields it searches. */
export const query = writable<string>('')
export const filterBarOpen = writable<boolean>(true)

export type { SearchField }
export const SEARCH_FIELDS: { key: SearchField; icon: string; label: string }[] = [
  { key: 'name', icon: 'type', label: 'Name' },
  { key: 'folderName', icon: 'folder', label: 'Folder Name' },
  { key: 'folderDesc', icon: 'note', label: 'Folder Description' },
  { key: 'extension', icon: 'code', label: 'Extension' },
  { key: 'tags', icon: 'tag', label: 'Tags' },
  { key: 'url', icon: 'link', label: 'URL' },
  { key: 'comment', icon: 'message', label: 'Comment' },
  { key: 'note', icon: 'note', label: 'Note' }
]
export const searchFields = writable<Record<SearchField, boolean>>({
  name: true, folderName: true, folderDesc: true, extension: true,
  tags: true, url: true, comment: true, note: true
})
export const showInspector = writable<boolean>(true)
export const inspectorPinned = writable<boolean>(false)

// ---------- layout & thumbnail ----------
export type Layout = 'waterfall' | 'justified' | 'grid' | 'list'
export const layout = writable<Layout>('waterfall')
export const thumbQuality = writable<'speed' | 'quality'>('quality')

// ---------- per-card display toggles ----------
export type InfoField = 'dimensions' | 'size' | 'dateAdded' | 'extension'
export const showName = writable<boolean>(true)
export const showItemInfo = writable<boolean>(true)
export const itemInfoField = writable<InfoField>('dimensions')
export const showExtension = writable<boolean>(true)
export const showExtensionLabel = writable<boolean>(true)
export const showAnnotation = writable<boolean>(true)
export const showSubfolderContents = writable<boolean>(false)

// ---------- sort ----------
export type SortKey =
  | 'custom'
  | 'dateAdded'
  | 'dateModified'
  | 'dateCreated'
  | 'title'
  | 'extension'
  | 'size'
  | 'dimensions'
  | 'rating'
  | 'duration'
export const sortKey = writable<SortKey>('custom')
export const sortDir = writable<'asc' | 'desc'>('asc')

// ---------- folders & tags ----------
export const folders = writable<RakFolder[]>([])
export const smartFolders = writable<RakSmartFolder[]>([])
/** Canonical tags saved in the library (tags.json). */
export const libraryTags = writable<string[]>([])
/** All tags: canonical list ∪ tags used on items. */
export const allTags = derived([items, libraryTags], ([$items, $lib]) => {
  const set = new Set<string>($lib)
  for (const it of $items) for (const t of it.tags ?? []) set.add(t)
  return [...set].sort((a, b) => a.localeCompare(b))
})

export async function loadFolders(): Promise<void> {
  folders.set(await window.rak.listFolders())
}
export async function loadSmartFolders(): Promise<void> {
  smartFolders.set(await window.rak.listSmartFolders())
}
export async function loadTags(): Promise<void> {
  libraryTags.set(await window.rak.listTags())
}
export async function addTag(name: string): Promise<void> {
  libraryTags.set(await window.rak.createTag(name))
}
export async function deleteTagGlobal(name: string): Promise<void> {
  libraryTags.set(await window.rak.deleteTag(name))
  filters.update((f) => ({ ...f, tags: f.tags.filter((t) => t !== name) }))
  await loadItems()
}

// ---------- shape & color helpers ----------
export type Shape = 'any' | 'landscape' | 'portrait' | 'square'
export function shapeOf(it: RakItem): Shape {
  if (!it.width || !it.height) return 'square'
  const r = it.width / it.height
  if (r > 1.15) return 'landscape'
  if (r < 0.87) return 'portrait'
  return 'square'
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null
}
function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}
/** Distinct palette colours across the library (deduped by similarity). */
export const paletteColors = derived(items, ($items) => {
  const out: string[] = []
  const rgbs: [number, number, number][] = []
  for (const it of $items) {
    const pal = it.colors?.length ? it.colors : it.color ? [it.color] : []
    for (const c of pal) {
      const rgb = hexToRgb(c)
      if (!rgb) continue
      if (rgbs.some((x) => colorDist(x, rgb) < 42)) continue
      rgbs.push(rgb)
      out.push(c)
      if (out.length >= 28) return out
    }
  }
  return out
})

// ---------- filters ----------
export interface Filters {
  types: string[]
  folderId: string | null
  tags: string[]
  shape: Shape
  color: string | null // target hex; matches items with a similar palette colour
  ratingMin: number
  minWidth: number | null
  minHeight: number | null
  sizeMin: number | null // bytes
  sizeMax: number | null
  dateAddedFrom: string | null // yyyy-mm-dd
  dateAddedTo: string | null
  dateModifiedFrom: string | null
  dateModifiedTo: string | null
  durationMin: number | null // seconds
  durationMax: number | null
  comment: string
  note: string
  url: string
}
export const emptyFilters = (): Filters => ({
  types: [],
  folderId: null,
  tags: [],
  shape: 'any',
  color: null,
  ratingMin: 0,
  minWidth: null,
  minHeight: null,
  sizeMin: null,
  sizeMax: null,
  dateAddedFrom: null,
  dateAddedTo: null,
  dateModifiedFrom: null,
  dateModifiedTo: null,
  durationMin: null,
  durationMax: null,
  comment: '',
  note: '',
  url: ''
})
export const filters = writable<Filters>(emptyFilters())

/** Number of active filter criteria (for the toolbar badge). */
export const activeFilterCount = derived(filters, ($f) => {
  let n = 0
  if ($f.types.length) n++
  if ($f.folderId) n++
  if ($f.tags.length) n++
  if ($f.shape !== 'any') n++
  if ($f.color) n++
  if ($f.ratingMin) n++
  if ($f.minWidth || $f.minHeight) n++
  if ($f.sizeMin != null || $f.sizeMax != null) n++
  if ($f.dateAddedFrom || $f.dateAddedTo) n++
  if ($f.dateModifiedFrom || $f.dateModifiedTo) n++
  if ($f.durationMin != null || $f.durationMax != null) n++
  if ($f.comment.trim()) n++
  if ($f.note.trim()) n++
  if ($f.url.trim()) n++
  return n
})

export type SearchScope = 'library' | 'view'
export const searchScope = writable<SearchScope>('library')

/** Bumped each time the Random view is (re)opened, to reshuffle deterministically. */
export const randomSeed = writable<number>(1)

/** Stable pseudo-random ordering keyed by a seed (no Math.random, so it's stable per seed). */
function seededOrder(list: RakItem[], seed: number): RakItem[] {
  const hash = (s: string): number => {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i)
      h = Math.imul(h, 16777619)
    }
    return h >>> 0
  }
  return [...list].sort((a, b) => hash(`${a.id}:${seed}`) - hash(`${b.id}:${seed}`))
}

function baseForView(all: RakItem[], tr: RakItem[], v: View): RakItem[] {
  switch (v) {
    case 'trash':
      return tr
    case 'uncategorized':
      return all.filter((it) => !(it.folderIds ?? []).length)
    case 'untagged':
      return all.filter((it) => !it.tags || it.tags.length === 0)
    case 'alltags':
      return [] // the All Tags view renders a tag list, not the item grid
    default:
      return all
  }
}

function matchFilters(it: RakItem, f: Filters): boolean {
  if (f.types.length && !f.types.includes(it.ext)) return false
  if (f.folderId && !(it.folderIds ?? []).includes(f.folderId)) return false
  if (f.tags.length && !f.tags.every((t) => (it.tags ?? []).includes(t))) return false
  if (f.shape !== 'any' && shapeOf(it) !== f.shape) return false
  if (f.color) {
    const target = hexToRgb(f.color)
    const pal = it.colors?.length ? it.colors : it.color ? [it.color] : []
    const near = !!target && pal.some((c) => {
      const rgb = hexToRgb(c)
      return rgb ? colorDist(rgb, target) < 90 : false
    })
    if (!near) return false
  }
  if (f.ratingMin && (it.rating ?? 0) < f.ratingMin) return false
  if (f.minWidth && it.width < f.minWidth) return false
  if (f.minHeight && it.height < f.minHeight) return false
  if (f.sizeMin != null && it.size < f.sizeMin) return false
  if (f.sizeMax != null && it.size > f.sizeMax) return false
  if (f.dateAddedFrom && it.importedAt < f.dateAddedFrom) return false
  if (f.dateAddedTo && it.importedAt > f.dateAddedTo + 'T23:59:59') return false
  const mod = it.dateModified ?? it.importedAt
  if (f.dateModifiedFrom && mod < f.dateModifiedFrom) return false
  if (f.dateModifiedTo && mod > f.dateModifiedTo + 'T23:59:59') return false
  if (f.durationMin != null && (it.duration ?? 0) < f.durationMin) return false
  if (f.durationMax != null && (it.duration ?? 0) > f.durationMax) return false
  if (f.comment.trim() && !(it.comment ?? '').toLowerCase().includes(f.comment.trim().toLowerCase())) return false
  if (f.note.trim() && !(it.note ?? '').toLowerCase().includes(f.note.trim().toLowerCase())) return false
  if (f.url.trim() && !(it.url ?? '').toLowerCase().includes(f.url.trim().toLowerCase())) return false
  return true
}

function sortItems(list: RakItem[], key: SortKey, dir: 'asc' | 'desc'): RakItem[] {
  const s = (v: string | undefined) => v ?? ''
  const cmp: Record<SortKey, (a: RakItem, b: RakItem) => number> = {
    custom: (a, b) => (a.order ?? 0) - (b.order ?? 0) || b.importedAt.localeCompare(a.importedAt),
    dateAdded: (a, b) => a.importedAt.localeCompare(b.importedAt),
    dateModified: (a, b) => s(a.dateModified).localeCompare(s(b.dateModified)),
    dateCreated: (a, b) => s(a.dateCreated).localeCompare(s(b.dateCreated)),
    title: (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }),
    extension: (a, b) => a.ext.localeCompare(b.ext) || a.name.localeCompare(b.name),
    size: (a, b) => a.size - b.size,
    dimensions: (a, b) => a.width * a.height - b.width * b.height,
    rating: (a, b) => (a.rating ?? 0) - (b.rating ?? 0),
    duration: (a, b) => (a.duration ?? 0) - (b.duration ?? 0)
  }
  const out = [...list].sort(cmp[key])
  return dir === 'desc' ? out.reverse() : out
}

/** Items shown in the grid: view → filters → field query → sort. */
export const displayed = derived(
  [items, trash, view, sortKey, sortDir, filters, query, searchFields, folders, randomSeed],
  ([$items, $trash, $view, $sortKey, $sortDir, $filters, $query, $fields, $folders, $seed]) => {
    const terms = parseQuery($query.trim())
    const folderName = new Map($folders.map((f) => [f.id, f.name]))
    let out = baseForView($items, $trash, $view).filter((it) => matchFilters(it, $filters))
    if (terms.length)
      out = out.filter((it) =>
        matchTerms(it, terms, {
          fields: $fields,
          folderNames: (it.folderIds ?? []).map((id) => folderName.get(id) ?? '').filter(Boolean)
        })
      )
    // "Recently Used" and "Random" impose their own ordering (ignore the sort control).
    if ($view === 'recent') {
      return out
        .filter((it) => it.lastUsedAt)
        .sort((a, b) => (b.lastUsedAt ?? '').localeCompare(a.lastUsedAt ?? ''))
    }
    if ($view === 'random') return seededOrder(out, $seed)
    return sortItems(out, $sortKey, $sortDir)
  }
)

/** Reload active items + trash from disk. */
export async function refresh(): Promise<void> {
  await Promise.all([loadItems(), loadTrash()])
}

/** Scan for duplicate items (in the current mode) and open the results modal. */
export async function findDuplicates(mode = get(duplicateMode)): Promise<void> {
  duplicateMode.set(mode)
  duplicatesOpen.set(true)
  duplicatesBusy.set(true)
  try {
    duplicateGroups.set(
      mode === 'similar' ? await window.rak.findSimilar() : await window.rak.findDuplicates()
    )
  } finally {
    duplicatesBusy.set(false)
  }
}

/** Import an Eagle library, then reload everything it may have touched. */
export async function importEagleLibrary(): Promise<RakEagleResult | null> {
  const stop = window.rak.onEagleProgress((p) => eagleProgress.set(p))
  try {
    const result = await window.rak.importEagle()
    if (result) {
      await Promise.all([loadItems(), loadTrash(), loadFolders(), loadTags()])
      const lib = get(library)
      if (lib) library.set({ ...lib, itemCount: get(items).length })
      enrichDurations()
      enrichThumbnails()
    }
    return result
  } finally {
    stop()
    eagleProgress.set(null)
  }
}

// ---------- watched folders ----------
export async function loadWatched(): Promise<void> {
  watchedFolders.set(await window.rak.listWatched())
}
export async function addWatchedFolder(): Promise<void> {
  watchedFolders.set(await window.rak.addWatched())
}
export async function removeWatchedFolder(dir: string): Promise<void> {
  watchedFolders.set(await window.rak.removeWatched(dir))
}

/** Open an item in its default app (the main process watches it for saves). */
export async function openExternally(id: string): Promise<void> {
  const err = await window.rak.openItemExternally(id)
  if (err) alert(`Could not open the file: ${err}`)
}

/** Replace an item everywhere it is held, e.g. after it changed on disk. */
function replaceItem(updated: RakItem): void {
  items.update((cur) => cur.map((it) => (it.id === updated.id ? updated : it)))
  trash.update((cur) => cur.map((it) => (it.id === updated.id ? updated : it)))
}

// Events pushed from the main process.
window.rak.onItemsChanged((item) => {
  replaceItem(item)
  cacheBust.update((n) => n + 1)
  enrichDurations()
  enrichThumbnails()
})
window.rak.onItemsAdded((fresh) => addItems(fresh))

export function setView(v: View): void {
  view.set(v)
  selectedId.set(null)
  if (v === 'random') randomSeed.update((n) => n + 1) // reshuffle each time Random is opened
}

/** Move the selection to the previous (-1) or next (+1) item in the current grid order. */
export function selectAdjacent(dir: 1 | -1): void {
  const list = get(displayed)
  if (!list.length) return
  const cur = get(selectedId)
  const i = list.findIndex((it) => it.id === cur)
  const next = i < 0 ? (dir === 1 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, i + dir))
  selectedId.set(list[next].id)
}

/** Navigate the open viewer to the previous (-1) / next (+1) item (wraps around). */
export function openAdjacent(dir: 1 | -1): void {
  const list = get(displayed)
  if (!list.length) return
  const cur = get(openId)
  const i = list.findIndex((it) => it.id === cur)
  const next = i < 0 ? (dir === 1 ? 0 : list.length - 1) : (i + dir + list.length) % list.length
  openId.set(list[next].id)
}

/** Crop an image item to a pixel region; updates the item + thumbnail in place. */
export async function cropItem(
  id: string,
  region: { left: number; top: number; width: number; height: number }
): Promise<boolean> {
  const updated = await window.rak.cropItem(id, region)
  if (!updated) return false
  items.update((cur) => cur.map((it) => (it.id === id ? updated : it)))
  cacheBust.update((n) => n + 1)
  return true
}

/** Record that an item was just opened (updates its Recently Used timestamp). */
export async function markItemUsed(id: string): Promise<void> {
  const updated = await window.rak.touchItem(id)
  if (!updated) return
  items.update((cur) => cur.map((it) => (it.id === id ? updated : it)))
}
/** Column width in px for the waterfall grid (driven by the toolbar slider). */
export const thumbSize = writable<number>(220)
export const loading = writable<boolean>(false)
/** Bumped to force <img> thumbnails to reload after a cache rebuild. */
export const cacheBust = writable<number>(0)

/** Reload the active item list from the current library into the store. */
export async function loadItems(): Promise<void> {
  items.set(await window.rak.listItems())
}

/** Reload the trash list from the current library into the store. */
export async function loadTrash(): Promise<void> {
  trash.set(await window.rak.listTrash())
}

/** Refresh the known-libraries list from config. */
export async function loadLibraries(): Promise<void> {
  libraries.set(await window.rak.listLibraries())
}

/** Set the active library, (re)load its items + trash + folders, refresh known list. */
export async function useLibrary(lib: RakLibrary): Promise<void> {
  library.set(lib)
  selectedId.set(null)
  view.set('all')
  await Promise.all([
    loadItems(),
    loadTrash(),
    loadFolders(),
    loadSmartFolders(),
    loadTags(),
    loadLibraries(),
    loadWatched()
  ])
  enrichDurations()
  enrichThumbnails()
}

// ---------- smart folders ----------
export async function addSmartFolder(name: string): Promise<void> {
  await window.rak.createSmartFolder(name, get(filters))
  await loadSmartFolders()
}
export async function removeSmartFolder(id: string): Promise<void> {
  smartFolders.set(await window.rak.deleteSmartFolder(id))
}
export function applySmartFolder(sf: RakSmartFolder): void {
  view.set('all')
  selectedId.set(null)
  filters.set({ ...emptyFilters(), ...(sf.filters as Filters) })
}

// ---------- duration enrichment (probe media metadata in the renderer) ----------
let enriching = false
function probeDuration(it: RakItem): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(it.kind === 'video' ? 'video' : 'audio')
    el.preload = 'metadata'
    const done = (v: number | null) => {
      el.removeAttribute('src')
      resolve(v)
    }
    el.onloadedmetadata = () => done(isFinite(el.duration) ? el.duration : null)
    el.onerror = () => done(null)
    el.src = `asset://original/${it.id}`
    setTimeout(() => done(null), 8000)
  })
}
export async function enrichDurations(): Promise<void> {
  if (enriching) return
  enriching = true
  try {
    const media = get(items).filter(
      (it) => (it.kind === 'video' || it.kind === 'audio') && it.duration == null
    )
    for (const it of media) {
      const d = await probeDuration(it)
      if (d != null) await updateItemMeta(it.id, { duration: d })
    }
  } finally {
    enriching = false
  }
}

// ---------- video poster thumbnails (captured in the renderer) ----------
let posterizing = false

/** Capture a poster frame from a video item; returns webp bytes + video dims. */
function captureVideoPoster(
  it: RakItem
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  return new Promise((resolve) => {
    let settled = false
    let url: string | null = null
    const v = document.createElement('video')
    const finish = (val: { bytes: Uint8Array; width: number; height: number } | null): void => {
      if (settled) return
      settled = true
      v.removeAttribute('src')
      if (url) URL.revokeObjectURL(url)
      resolve(val)
    }
    v.muted = true
    v.preload = 'auto'
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(1, (isFinite(v.duration) ? v.duration : 2) * 0.1)
      } catch {
        finish(null)
      }
    }
    v.onseeked = () => {
      const w = v.videoWidth
      const h = v.videoHeight
      if (!w || !h) return finish(null)
      const cap = 640
      const scale = Math.min(1, cap / w)
      const cw = Math.max(1, Math.round(w * scale))
      const chh = Math.max(1, Math.round(h * scale))
      const canvas = document.createElement('canvas')
      canvas.width = cw
      canvas.height = chh
      const ctx = canvas.getContext('2d')
      if (!ctx) return finish(null)
      ctx.drawImage(v, 0, 0, cw, chh)
      canvas.toBlob(
        async (b) => {
          if (!b) return finish(null)
          finish({ bytes: new Uint8Array(await b.arrayBuffer()), width: w, height: h })
        },
        'image/webp',
        0.85
      )
    }
    v.onerror = () => finish(null)
    setTimeout(() => finish(null), 15000)
    // Fetch to a same-origin blob URL so the canvas isn't tainted (asset:// is cross-origin).
    fetch(`asset://original/${it.id}`)
      .then((r) => r.blob())
      .then((blob) => {
        url = URL.createObjectURL(blob)
        v.src = url
      })
      .catch(() => finish(null))
  })
}

const RENDERED_KINDS = new Set<RakItemKind>(['video', 'pdf', 'font'])

function renderThumbnail(it: RakItem): Promise<Thumb | null> {
  if (it.kind === 'video') return captureVideoPoster(it)
  const render = it.kind === 'pdf' ? pdfThumbnail : fontThumbnail
  return render(it.id).catch((err) => {
    console.error(`Cannot render a thumbnail for ${it.name}.${it.ext}:`, err)
    return null
  })
}

// Items whose thumbnail could not be drawn, keyed by id + modified time, so a
// broken file is not retried on every pass but is retried once it changes.
const thumbnailFailed = new Set<string>()

/** Draw thumbnails for video, PDF and font items that don't have one yet. */
export async function enrichThumbnails(): Promise<void> {
  if (posterizing) return
  posterizing = true
  try {
    // Loop until nothing is left, so items added mid-run are not skipped.
    for (;;) {
      const todo = get(items).find(
        (it) =>
          RENDERED_KINDS.has(it.kind) &&
          !it.thumbnail &&
          !thumbnailFailed.has(`${it.id}@${it.dateModified}`)
      )
      if (!todo) break
      const it = todo
      const poster = await renderThumbnail(it)
      if (!poster) {
        thumbnailFailed.add(`${it.id}@${it.dateModified}`)
        continue
      }
      const updated = await window.rak.setItemThumbnail(it.id, poster.bytes, poster.width, poster.height)
      if (updated) {
        items.update((cur) => cur.map((x) => (x.id === it.id ? updated : x)))
        cacheBust.update((n) => n + 1)
      } else {
        thumbnailFailed.add(`${it.id}@${it.dateModified}`)
      }
    }
  } finally {
    posterizing = false
  }
}

/** Update an item's metadata (rating/tags/folder/comment/note/url) in place. */
export async function updateItemMeta(id: string, patch: RakItemPatch): Promise<void> {
  const updated = await window.rak.updateItem(id, patch)
  if (!updated) return
  items.update((cur) => cur.map((it) => (it.id === id ? updated : it)))
  trash.update((cur) => cur.map((it) => (it.id === id ? updated : it)))
}

export async function addFolder(name: string): Promise<RakFolder> {
  const f = await window.rak.createFolder(name)
  await loadFolders()
  return f
}
export async function renameFolder(id: string, name: string): Promise<void> {
  await window.rak.renameFolder(id, name)
  await loadFolders()
}
export async function removeFolder(id: string): Promise<void> {
  await window.rak.deleteFolder(id)
  filters.update((f) => (f.folderId === id ? { ...f, folderId: null } : f))
  await Promise.all([loadFolders(), loadItems()])
}

/** Switch to a known library by path. Returns false if it couldn't be opened. */
export async function switchTo(path: string): Promise<boolean> {
  const cur = get(library)
  if (cur && cur.path === path) return true
  const lib = await window.rak.switchLibrary(path)
  if (!lib) {
    await loadLibraries() // reflect availability change
    return false
  }
  await useLibrary(lib)
  return true
}

/** Forget a library (remove from list, keep files). */
export async function forgetLibrary(path: string): Promise<void> {
  libraries.set(await window.rak.forgetLibrary(path))
}

/** Show the native per-library menu and apply whatever the user chose. */
export async function libraryMenu(path: string): Promise<void> {
  const res = await window.rak.libraryContextMenu(path)
  if (!res) return
  const cur = get(library)
  await loadLibraries()

  switch (res.action) {
    case 'icon':
      if (cur && cur.path === path) {
        const icon = get(libraries).find((l) => l.path === path)?.icon
        if (icon) library.set({ ...cur, icon })
      }
      break
    case 'merge':
      // Target gained items; reload if we're viewing it.
      if (cur && cur.path === res.target) await loadItems()
      break
    case 'delete':
      if (cur && cur.path === path) {
        const next = get(libraries).find((l) => l.available)
        if (next) await switchTo(next.path)
        else {
          library.set(null)
          items.set([])
        }
      }
      break
    // 'reveal' and 'remove' need no further work beyond loadLibraries().
  }
}

/** "Empty cache & reload": regenerate thumbnails and refresh the grid. */
export async function emptyCacheReload(): Promise<void> {
  await window.rak.rebuildThumbnails()
  await loadItems()
  cacheBust.update((n) => n + 1)
  enrichThumbnails()
}

/** Persist a new manual ordering (full list of ids, first = top-left). */
export async function applyOrder(orderedIds: string[]): Promise<void> {
  const rank = new Map(orderedIds.map((id, i) => [id, i]))
  items.update((cur) => {
    const next = cur.map((it) => (rank.has(it.id) ? { ...it, order: rank.get(it.id) as number } : it))
    next.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    return next
  })
  await window.rak.reorderItems(orderedIds)
}

/** Append freshly imported items to the top of the list. */
export function addItems(fresh: RakItem[]): void {
  if (!fresh.length) return
  items.update((cur) => [...fresh, ...cur])
  library.update((lib) => (lib ? { ...lib, itemCount: lib.itemCount + fresh.length } : lib))
  // Some kinds need renderer-side enrichment (duration, poster, page or font preview).
  if (fresh.some((it) => it.kind === 'audio' || RENDERED_KINDS.has(it.kind))) {
    enrichDurations()
    enrichThumbnails()
  }
}

/** Move an item to the trash. */
export async function trashItem(id: string): Promise<void> {
  await window.rak.trashItem(id)
  selectedId.update((cur) => (cur === id ? null : cur))
  await Promise.all([loadItems(), loadTrash()])
}

/** Restore an item from the trash. */
export async function restoreItem(id: string): Promise<void> {
  await window.rak.restoreItem(id)
  selectedId.update((cur) => (cur === id ? null : cur))
  await Promise.all([loadItems(), loadTrash()])
}

/** Permanently delete a single trashed item. */
export async function deleteForever(id: string): Promise<void> {
  await window.rak.deleteItemForever(id)
  selectedId.update((cur) => (cur === id ? null : cur))
  await loadTrash()
}

/** Permanently delete everything in the trash. */
export async function emptyTrash(): Promise<void> {
  await window.rak.emptyTrash()
  await loadTrash()
}

// ---------- persisted UI preferences (survive relaunch) ----------
let prefsReady = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

function collectPrefs(): Record<string, unknown> {
  return {
    filters: get(filters),
    sortKey: get(sortKey),
    sortDir: get(sortDir),
    layout: get(layout),
    thumbSize: get(thumbSize),
    thumbQuality: get(thumbQuality),
    searchScope: get(searchScope),
    searchFields: get(searchFields),
    filterBarOpen: get(filterBarOpen),
    showInspector: get(showInspector),
    inspectorPinned: get(inspectorPinned),
    showName: get(showName),
    showItemInfo: get(showItemInfo),
    itemInfoField: get(itemInfoField),
    showExtension: get(showExtension),
    showExtensionLabel: get(showExtensionLabel),
    showAnnotation: get(showAnnotation),
    showSubfolderContents: get(showSubfolderContents)
  }
}

function schedulePersist(): void {
  if (!prefsReady) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void window.rak.setPrefs(collectPrefs()), 300)
}

/** Load persisted UI prefs from disk into the stores, then keep them in sync. */
export async function loadPrefs(): Promise<void> {
  let p: Record<string, unknown> = {}
  try {
    p = (await window.rak.getPrefs()) ?? {}
  } catch {
    p = {}
  }

  if (p.filters) filters.set({ ...emptyFilters(), ...(p.filters as Partial<Filters>) })
  if (p.sortKey) sortKey.set(p.sortKey as SortKey)
  if (p.sortDir) sortDir.set(p.sortDir as 'asc' | 'desc')
  if (p.layout) layout.set(p.layout as Layout)
  if (typeof p.thumbSize === 'number') thumbSize.set(p.thumbSize)
  if (p.thumbQuality) thumbQuality.set(p.thumbQuality as 'speed' | 'quality')
  if (p.searchScope) searchScope.set(p.searchScope as SearchScope)
  if (p.searchFields)
    searchFields.set({ ...get(searchFields), ...(p.searchFields as Record<SearchField, boolean>) })
  if (typeof p.filterBarOpen === 'boolean') filterBarOpen.set(p.filterBarOpen)
  if (typeof p.showInspector === 'boolean') showInspector.set(p.showInspector)
  if (typeof p.inspectorPinned === 'boolean') inspectorPinned.set(p.inspectorPinned)
  if (typeof p.showName === 'boolean') showName.set(p.showName)
  if (typeof p.showItemInfo === 'boolean') showItemInfo.set(p.showItemInfo)
  if (p.itemInfoField) itemInfoField.set(p.itemInfoField as InfoField)
  if (typeof p.showExtension === 'boolean') showExtension.set(p.showExtension)
  if (typeof p.showExtensionLabel === 'boolean') showExtensionLabel.set(p.showExtensionLabel)
  if (typeof p.showAnnotation === 'boolean') showAnnotation.set(p.showAnnotation)
  if (typeof p.showSubfolderContents === 'boolean')
    showSubfolderContents.set(p.showSubfolderContents)

  prefsReady = true

  // Persist any future change (debounced).
  const stores: { subscribe: (run: (v: unknown) => void) => unknown }[] = [
    filters, sortKey, sortDir, layout, thumbSize, thumbQuality, searchScope, searchFields,
    filterBarOpen, showInspector, inspectorPinned, showName, showItemInfo, itemInfoField,
    showExtension, showExtensionLabel, showAnnotation, showSubfolderContents
  ]
  for (const s of stores) s.subscribe(() => schedulePersist())
}
