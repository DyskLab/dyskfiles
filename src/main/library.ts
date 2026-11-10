import { promises as fs } from 'fs'
import { basename, extname, join } from 'path'
import sharp from 'sharp'
import { makeThumbnail, makeThumbnailFromBuffer } from './thumbnail'

export const DEFAULT_ICON = 'folder'

export interface Library {
  name: string
  icon: string
  version: number
  createdAt: string
  itemCount: number
  path: string // absolute path on disk (not persisted inside library.json)
}

export type ItemKind = 'image' | 'text' | 'video' | 'audio'

export interface Item {
  id: string
  name: string
  ext: string
  kind: ItemKind
  size: number
  width: number
  height: number
  importedAt: string
  dateModified: string // source file's last-modified time (ISO)
  dateCreated: string // source file's creation time (ISO)
  rating: number // 0–5 (0 = unrated)
  duration: number | null // seconds, for video/audio
  color: string | null // dominant color #rrggbb
  colors: string[] // palette
  comment: string
  note: string
  url: string
  order: number // manual sort position (ascending = earlier in the grid)
  original: string // relative path inside the library
  thumbnail: string // relative path inside the library
  tags: string[]
  folderIds: string[] // folders this item belongs to (an item can be in several)
  lastUsedAt: string | null // ISO timestamp of the last time the item was opened
  deletedAt: string | null // ISO timestamp when moved to trash, else null
  linked: boolean // true = `original` is an absolute path to an external file (not copied in)
}

export interface Folder {
  id: string
  name: string
  createdAt: string
}

export const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tiff', '.avif', '.svg']
export const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.m4v', '.mkv', '.avi', '.ogv']
export const AUDIO_EXTS = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a', '.opus']
export const TEXT_EXTS = [
  '.txt', '.md', '.markdown', '.json', '.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx',
  '.css', '.scss', '.less', '.html', '.htm', '.xml', '.yml', '.yaml', '.csv', '.log',
  '.sh', '.bash', '.zsh', '.py', '.java', '.c', '.h', '.cpp', '.cs', '.go', '.rs',
  '.php', '.rb', '.sql', '.toml', '.ini', '.conf', '.env'
]
export const SUPPORTED_EXTS = [...IMAGE_EXTS, ...VIDEO_EXTS, ...AUDIO_EXTS, ...TEXT_EXTS]

function kindForExt(ext: string): ItemKind {
  const e = ext.toLowerCase()
  if (IMAGE_EXTS.includes(e)) return 'image'
  if (VIDEO_EXTS.includes(e)) return 'video'
  if (AUDIO_EXTS.includes(e)) return 'audio'
  return 'text'
}

const LIBRARY_VERSION = 1
const CONFIG_FILES: Record<string, unknown> = {
  'tags.json': [],
  'filters.json': [],
  'folders.json': []
}

let currentLibraryPath: string | null = null

// ---------- helpers ----------

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'item'
}

function makeId(baseName: string): string {
  const rand = Math.random().toString(36).slice(2, 4)
  return `${slugify(baseName)}-${Date.now().toString(36)}${rand}`
}

/**
 * Bucket folder for an item: the first 3 alphanumeric characters of its id
 * (i.e. the file name's initials). Items sharing initials land in one folder.
 */
function bucketFor(id: string): string {
  const s = id.toLowerCase().replace(/[^a-z0-9]/g, '')
  return s.slice(0, 3) || '_'
}

/** Absolute path to an item's metadata JSON, inside its bucket folder. */
function itemJsonPath(libPath: string, id: string): string {
  return join(libPath, bucketFor(id), `${id}.json`)
}

/** Absolute path to an item's original file (external if linked, else in-library). */
function originalAbs(libPath: string, item: Item): string {
  return item.linked ? item.original : join(libPath, item.original)
}

/**
 * Write JSON atomically: write a temp file beside the target, then rename over it,
 * so a crash mid-write never leaves a truncated metadata file behind. The temp name
 * ends in `.tmp`, so the item scanner never mistakes it for an item.
 */
async function writeJson(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.${process.pid}-${Math.random().toString(36).slice(2, 8)}.tmp`
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
  try {
    await fs.rename(tmp, path)
  } catch (err) {
    await fs.rm(tmp, { force: true })
    throw err
  }
}

/** Run `fn` over `list` with at most `limit` calls in flight (keeps file handles bounded). */
async function forEachLimit<T>(list: T[], limit: number, fn: (x: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < list.length) await fn(list[next++])
  }
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, worker))
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await fs.readFile(path, 'utf-8')) as T
}

function libraryJsonPath(libPath: string): string {
  return join(libPath, 'library.json')
}

async function exists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

type LibraryMeta = Omit<Library, 'path'>

async function readMeta(libPath: string): Promise<LibraryMeta> {
  const meta = await readJson<Partial<LibraryMeta>>(libraryJsonPath(libPath))
  return {
    name: meta.name ?? basename(libPath),
    icon: meta.icon ?? DEFAULT_ICON,
    version: meta.version ?? LIBRARY_VERSION,
    createdAt: meta.createdAt ?? new Date().toISOString(),
    itemCount: meta.itemCount ?? 0
  }
}

async function writeMeta(libPath: string, meta: LibraryMeta): Promise<void> {
  await writeJson(libraryJsonPath(libPath), meta)
}

const RESERVED_ENTRIES = new Set(['library.json', 'tags.json', 'filters.json', 'folders.json'])

/** Scan every item metadata file in a library from disk, keyed by id. */
async function scanItems(libPath: string): Promise<Map<string, Item>> {
  await migrateLibrary(libPath)
  const items = new Map<string, Item>()
  let entries: { name: string; isDirectory(): boolean }[] = []
  try {
    entries = await fs.readdir(libPath, { withFileTypes: true })
  } catch {
    return items
  }
  const buckets = entries.filter((e) => e.isDirectory() && !RESERVED_ENTRIES.has(e.name))
  await forEachLimit(buckets, 16, async (entry) => {
    let files: string[] = []
    try {
      files = await fs.readdir(join(libPath, entry.name))
    } catch {
      return
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      try {
        const item = normalizeItem(
          await readJson<Item & { folderId?: string | null }>(join(libPath, entry.name, file))
        )
        if (typeof item.id === 'string') items.set(item.id, item)
      } catch {
        // Skip corrupt entries.
      }
    }
  })
  return items
}

// ---------- item cache ----------
//
// Item metadata is read from disk once per library and then kept in memory; every
// write goes through `saveItem` / `dropItem`, which update the JSON file and the
// cache together. Opening a library rescans it, so edits made outside the app are
// picked up on the next open. Callers always get copies, so mutating a returned
// item never changes the cache unless it is saved.

const itemCache = new Map<string, Promise<Map<string, Item>>>()

function loadItems(libPath: string): Promise<Map<string, Item>> {
  let cached = itemCache.get(libPath)
  if (!cached) {
    cached = scanItems(libPath)
    itemCache.set(libPath, cached)
    cached.catch(() => itemCache.delete(libPath))
  }
  return cached
}

function invalidateItems(libPath: string): void {
  itemCache.delete(libPath)
}

/** Every item in a library (unsorted), as copies. */
async function readItemsAt(libPath: string): Promise<Item[]> {
  return Array.from((await loadItems(libPath)).values(), (it) => structuredClone(it))
}

/** One item by id, as a copy, or null if it does not exist. */
async function readItem(libPath: string, id: string): Promise<Item | null> {
  const item = (await loadItems(libPath)).get(id)
  return item ? structuredClone(item) : null
}

/** Persist an item's metadata to disk, then to the cache. */
async function saveItem(libPath: string, item: Item): Promise<void> {
  await writeJson(itemJsonPath(libPath, item.id), item)
  ;(await loadItems(libPath)).set(item.id, structuredClone(item))
}

/** Remove an item's metadata file and its cache entry. */
async function dropItem(libPath: string, id: string): Promise<void> {
  await fs.rm(itemJsonPath(libPath, id), { force: true })
  ;(await loadItems(libPath)).delete(id)
}

/** Back-compat: coerce a legacy single `folderId` into the `folderIds` array. */
function normalizeItem(raw: Item & { folderId?: string | null }): Item {
  if (!Array.isArray(raw.folderIds)) {
    raw.folderIds = raw.folderId ? [raw.folderId] : []
  }
  if (raw.lastUsedAt === undefined) raw.lastUsedAt = null
  if (typeof raw.linked !== 'boolean') raw.linked = false
  delete raw.folderId
  return raw
}

const migrated = new Set<string>()
/**
 * Migrate a legacy library (flat `items/` + `originals/` + `thumbnails/`) into the
 * per-bucket layout: each item's json/original/thumbnail live together in a folder
 * named by its first 3 initials. No-op once migrated. Runs at most once per session.
 */
async function migrateLibrary(libPath: string): Promise<void> {
  if (migrated.has(libPath)) return
  const itemsDir = join(libPath, 'items')
  let files: string[]
  try {
    files = await fs.readdir(itemsDir)
  } catch {
    migrated.add(libPath) // no legacy folder → nothing to do
    return
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = await readJson<Item & { folderId?: string | null }>(join(itemsDir, file))
      const item = normalizeItem(raw)
      const bucket = bucketFor(item.id)
      await fs.mkdir(join(libPath, bucket), { recursive: true })
      // Move original.
      if (item.original) {
        const dest = join(bucket, `${item.id}${extname(item.original)}`)
        try {
          await fs.rename(join(libPath, item.original), join(libPath, dest))
        } catch {
          /* already moved/missing */
        }
        item.original = dest
      }
      // Move thumbnail.
      if (item.thumbnail) {
        const dest = join(bucket, `${item.id}.webp`)
        try {
          await fs.rename(join(libPath, item.thumbnail), join(libPath, dest))
        } catch {
          /* already moved/missing */
        }
        item.thumbnail = dest
      }
      await writeJson(join(libPath, bucket, `${item.id}.json`), item)
    } catch {
      // Skip corrupt entry.
    }
  }
  // Drop the now-empty legacy folders.
  for (const dir of ['items', 'originals', 'thumbnails']) {
    await fs.rm(join(libPath, dir), { recursive: true, force: true })
  }
  migrated.add(libPath)
}

// ---------- state ----------

export function getCurrentPath(): string | null {
  return currentLibraryPath
}

export function setCurrentPath(path: string | null): void {
  currentLibraryPath = path
}

function requireCurrent(): string {
  if (!currentLibraryPath) throw new Error('No library is currently open')
  return currentLibraryPath
}

async function loadLibraryMeta(libPath: string): Promise<Library> {
  // Fails (throws) if library.json is missing — used to validate a folder.
  await fs.access(libraryJsonPath(libPath))
  const meta = await readMeta(libPath)
  return { ...meta, path: libPath }
}

// ---------- lifecycle ----------

export async function createLibrary(parentDir: string, name: string): Promise<Library> {
  const cleanName = name.trim() || 'Untitled'
  const folderName = `${slugify(cleanName)}.dyskfiles`
  const libPath = join(parentDir, folderName)

  await fs.mkdir(libPath, { recursive: true })
  // Bucket folders (named by each item's initials) are created on demand at import.
  for (const [file, contents] of Object.entries(CONFIG_FILES)) {
    await writeJson(join(libPath, file), contents)
  }

  const meta: LibraryMeta = {
    name: cleanName,
    icon: DEFAULT_ICON,
    version: LIBRARY_VERSION,
    createdAt: new Date().toISOString(),
    itemCount: 0
  }
  await writeMeta(libPath, meta)

  invalidateItems(libPath)
  currentLibraryPath = libPath
  return { ...meta, path: libPath }
}

/** Change a library's display icon (works on any library, not just the current one). */
export async function setIcon(libPath: string, icon: string): Promise<void> {
  const meta = await readMeta(libPath)
  meta.icon = icon || DEFAULT_ICON
  await writeMeta(libPath, meta)
}

export async function openLibrary(libPath: string): Promise<Library> {
  // Validate: must contain a readable library.json.
  const lib = await loadLibraryMeta(libPath)
  // Rescan on every open so changes made outside the app are picked up.
  invalidateItems(libPath)
  currentLibraryPath = libPath
  return lib
}

/** Try to reopen a library from a persisted path; returns null if it's gone. */
export async function tryOpen(libPath: string | null): Promise<Library | null> {
  if (!libPath) return null
  try {
    return await openLibrary(libPath)
  } catch {
    return null
  }
}

// ---------- items ----------

export async function listItems(): Promise<Item[]> {
  const items = (await readItemsAt(requireCurrent())).filter((it) => !it.deletedAt)
  // Manual order ascending; ties (and legacy items) fall back to newest-first.
  items.sort((a, b) => {
    const ao = a.order ?? 0
    const bo = b.order ?? 0
    if (ao !== bo) return ao - bo
    return b.importedAt.localeCompare(a.importedAt)
  })
  return items
}

/** Items currently in the trash, most-recently-deleted first. */
export async function listTrash(): Promise<Item[]> {
  const items = (await readItemsAt(requireCurrent())).filter((it) => it.deletedAt)
  items.sort((a, b) => (b.deletedAt ?? '').localeCompare(a.deletedAt ?? ''))
  return items
}

async function updateItemCount(libPath: string): Promise<void> {
  const active = (await readItemsAt(libPath)).filter((it) => !it.deletedAt).length
  const meta = await readMeta(libPath)
  meta.itemCount = active
  await writeMeta(libPath, meta)
}

/** Expand any directories in `paths` into a flat list of supported image files. */
async function expandToImages(paths: string[]): Promise<string[]> {
  const out: string[] = []
  for (const p of paths) {
    let stat
    try {
      stat = await fs.stat(p)
    } catch {
      continue
    }
    if (stat.isDirectory()) {
      const entries = await fs.readdir(p, { withFileTypes: true })
      // Skip hidden files/folders (e.g. .DS_Store, .git).
      const children = entries.filter((e) => !e.name.startsWith('.')).map((e) => join(p, e.name))
      out.push(...(await expandToImages(children)))
    } else if (SUPPORTED_EXTS.includes(extname(p).toLowerCase())) {
      out.push(p)
    }
  }
  return out
}

export async function importPaths(
  paths: string[],
  folderId: string | null = null,
  linked = false
): Promise<Item[]> {
  const libPath = requireCurrent()
  const imported: Item[] = []
  // Accept files and folders (folders are walked recursively for images).
  const sources = await expandToImages(paths)
  // New items sort to the top: give them orders below the current minimum.
  const existing = await readItemsAt(libPath)
  let nextOrder = existing.reduce((min, it) => Math.min(min, it.order ?? 0), 0) - 1

  for (const src of sources) {
    const ext = extname(src).toLowerCase()
    if (!SUPPORTED_EXTS.includes(ext)) continue

    const displayName = basename(src, extname(src))
    const id = makeId(displayName)
    const kind = kindForExt(ext)
    const bucket = bucketFor(id)
    const originalRel = join(bucket, `${id}${ext}`) // only used when copying
    const copyDest = join(libPath, originalRel)
    const thumbnailRel = kind === 'image' ? join(bucket, `${id}.webp`) : ''
    const thumbnailAbs = thumbnailRel ? join(libPath, thumbnailRel) : ''

    try {
      await fs.mkdir(join(libPath, bucket), { recursive: true })
      // Stat the source first so we can keep its real modified/created times.
      const srcStat = await fs.stat(src)
      // Linked import references the source in place; copy import duplicates it in.
      if (!linked) await fs.copyFile(src, copyDest)
      const imgSource = linked ? src : copyDest

      let width = 0
      let height = 0
      let color: string | null = null
      let colors: string[] = []
      if (kind === 'image') {
        const meta = await makeThumbnail(imgSource, thumbnailAbs)
        width = meta.width
        height = meta.height
        color = meta.color
        colors = meta.colors
      }
      const size = linked ? srcStat.size : (await fs.stat(copyDest)).size
      const created =
        srcStat.birthtime && srcStat.birthtime.getTime() > 0 ? srcStat.birthtime : srcStat.mtime

      const item: Item = {
        id,
        name: displayName,
        ext: ext.replace(/^\./, ''),
        kind,
        size,
        width,
        height,
        importedAt: new Date().toISOString(),
        dateModified: srcStat.mtime.toISOString(),
        dateCreated: created.toISOString(),
        rating: 0,
        duration: null,
        color,
        colors,
        comment: '',
        note: '',
        url: '',
        order: nextOrder--,
        original: linked ? src : originalRel,
        thumbnail: thumbnailRel,
        tags: [],
        folderIds: folderId ? [folderId] : [],
        lastUsedAt: null,
        deletedAt: null,
        linked
      }
      await saveItem(libPath, item)
      imported.push(item)
    } catch (err) {
      // Roll back partial files for this item (never the external source), then continue.
      if (!linked) await fs.rm(copyDest, { force: true })
      if (thumbnailAbs) await fs.rm(thumbnailAbs, { force: true })
      console.error(`Failed to import ${src}:`, err)
    }
  }

  if (imported.length) await updateItemCount(libPath)
  return imported
}

/** Move an item to the trash (soft delete — files are kept). */
export async function trashItem(id: string): Promise<void> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (!item) return
    item.deletedAt = new Date().toISOString()
    await saveItem(libPath, item)
  } catch {
    return
  }
  await updateItemCount(libPath)
}

/** Restore an item from the trash. */
export async function restoreItem(id: string): Promise<void> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (!item) return
    item.deletedAt = null
    await saveItem(libPath, item)
  } catch {
    return
  }
  await updateItemCount(libPath)
}

/** Permanently delete a single item and its files. */
export async function deleteItemForever(id: string): Promise<void> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (item) {
      if (!item.linked) await fs.rm(join(libPath, item.original), { force: true }) // keep external files
      if (item.thumbnail) await fs.rm(join(libPath, item.thumbnail), { force: true })
    }
  } catch {
    // Files already gone.
  }
  await dropItem(libPath, id)
  await updateItemCount(libPath)
}

/** Permanently delete every item in the trash. Returns how many were removed. */
export async function emptyTrash(): Promise<number> {
  const libPath = requireCurrent()
  const trashed = (await readItemsAt(libPath)).filter((it) => it.deletedAt)
  for (const item of trashed) {
    if (!item.linked) await fs.rm(join(libPath, item.original), { force: true }) // keep external files
    if (item.thumbnail) await fs.rm(join(libPath, item.thumbnail), { force: true })
    await dropItem(libPath, item.id)
  }
  if (trashed.length) await updateItemCount(libPath)
  return trashed.length
}

/** Persist a new manual order: `orderedIds[0]` becomes the first item, etc. */
export async function reorderItems(orderedIds: string[]): Promise<void> {
  const libPath = requireCurrent()
  await Promise.all(
    orderedIds.map(async (id, index) => {
      try {
        const item = await readItem(libPath, id)
        if (item && item.order !== index) {
          item.order = index
          await saveItem(libPath, item)
        }
      } catch {
        // Item vanished — ignore.
      }
    })
  )
}

/** Regenerate every thumbnail in the current library ("empty cache & reload"). */
export async function rebuildThumbnails(): Promise<number> {
  const libPath = requireCurrent()
  const items = await readItemsAt(libPath)
  let rebuilt = 0
  for (const item of items) {
    if (item.kind !== 'image' || !item.thumbnail) continue // only images can be rebuilt by sharp
    const originalPath = originalAbs(libPath, item)
    const thumbnailAbs = join(libPath, item.thumbnail)
    try {
      const { width, height } = await makeThumbnail(originalPath, thumbnailAbs)
      if (width && height && (width !== item.width || height !== item.height)) {
        item.width = width
        item.height = height
        await saveItem(libPath, item)
      }
      rebuilt++
    } catch (err) {
      console.error(`Failed to rebuild thumbnail for ${item.id}:`, err)
    }
  }
  return rebuilt
}

/** Copy every item from one library into another (source is left untouched). */
export async function mergeInto(sourcePath: string, targetPath: string): Promise<number> {
  if (sourcePath === targetPath) return 0
  const sourceItems = await readItemsAt(sourcePath)
  const targetItems = await readItemsAt(targetPath)
  let maxOrder = targetItems.reduce((max, it) => Math.max(max, it.order ?? 0), 0)
  let merged = 0

  const targetIds = new Set(targetItems.map((it) => it.id))
  for (const item of sourceItems) {
    let id = item.id
    if (targetIds.has(id) || (await exists(itemJsonPath(targetPath, id)))) id = makeId(item.name)
    targetIds.add(id)
    const bucket = bucketFor(id)
    const originalRel = join(bucket, `${id}.${item.ext}`)
    const thumbnailRel = item.thumbnail ? join(bucket, `${id}.webp`) : ''
    try {
      await fs.mkdir(join(targetPath, bucket), { recursive: true })
      // Linked items keep their external path (nothing to copy); others duplicate the file.
      if (!item.linked) {
        await fs.copyFile(join(sourcePath, item.original), join(targetPath, originalRel))
      }
      if (item.thumbnail) {
        await fs.copyFile(join(sourcePath, item.thumbnail), join(targetPath, thumbnailRel))
      }
      const copy: Item = {
        ...item,
        id,
        order: ++maxOrder,
        original: item.linked ? item.original : originalRel,
        thumbnail: thumbnailRel,
        folderIds: [], // folders don't carry across libraries
        lastUsedAt: null
      }
      await saveItem(targetPath, copy)
      merged++
    } catch (err) {
      console.error(`Failed to merge item ${item.id}:`, err)
    }
  }

  if (merged) await updateItemCount(targetPath)
  return merged
}

/** Permanently delete a library folder from disk. */
export async function deleteLibraryFiles(libPath: string): Promise<void> {
  // Safety: only delete something that actually looks like a DyskFiles library.
  if (!(await exists(libraryJsonPath(libPath)))) {
    throw new Error('Refusing to delete: not a DyskFiles library')
  }
  await fs.rm(libPath, { recursive: true, force: true })
  invalidateItems(libPath)
  if (currentLibraryPath === libPath) currentLibraryPath = null
}

// ---------- folders ----------

export async function listFolders(): Promise<Folder[]> {
  const libPath = requireCurrent()
  try {
    return await readJson<Folder[]>(join(libPath, 'folders.json'))
  } catch {
    return []
  }
}

export async function createFolder(name: string): Promise<Folder> {
  const libPath = requireCurrent()
  const folders = await listFolders()
  const folder: Folder = {
    id: makeId(name),
    name: name.trim() || 'Untitled',
    createdAt: new Date().toISOString()
  }
  folders.push(folder)
  await writeJson(join(libPath, 'folders.json'), folders)
  return folder
}

export async function renameFolder(id: string, name: string): Promise<Folder[]> {
  const libPath = requireCurrent()
  const folders = await listFolders()
  const f = folders.find((x) => x.id === id)
  if (f) f.name = name.trim() || f.name
  await writeJson(join(libPath, 'folders.json'), folders)
  return folders
}

export async function deleteFolder(id: string): Promise<Folder[]> {
  const libPath = requireCurrent()
  const folders = (await listFolders()).filter((x) => x.id !== id)
  await writeJson(join(libPath, 'folders.json'), folders)
  // Remove the deleted folder from every item's membership list.
  for (const it of await readItemsAt(libPath)) {
    if (it.folderIds.includes(id)) {
      it.folderIds = it.folderIds.filter((f) => f !== id)
      await saveItem(libPath, it)
    }
  }
  return folders
}

// ---------- item metadata updates (tags, rating, folder, comment, note, url) ----------

type ItemPatch = Partial<
  Pick<Item, 'name' | 'rating' | 'comment' | 'note' | 'url' | 'tags' | 'folderIds' | 'duration'>
>

export async function updateItem(id: string, patch: ItemPatch): Promise<Item | null> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (!item) return null
    if (patch.name !== undefined) item.name = patch.name
    if (patch.rating !== undefined) item.rating = patch.rating
    if (patch.duration !== undefined) item.duration = patch.duration
    if (patch.comment !== undefined) item.comment = patch.comment
    if (patch.note !== undefined) item.note = patch.note
    if (patch.url !== undefined) item.url = patch.url
    if (patch.tags !== undefined) item.tags = patch.tags
    if (patch.folderIds !== undefined) item.folderIds = patch.folderIds
    await saveItem(libPath, item)
    return item
  } catch {
    return null
  }
}

/**
 * Save a thumbnail captured in the renderer (e.g. a video poster frame) and
 * refresh the item's dimensions + palette from it.
 */
export async function setItemThumbnail(
  id: string,
  bytes: Uint8Array,
  width: number,
  height: number
): Promise<Item | null> {
  const libPath = requireCurrent()
  const thumbRel = join(bucketFor(id), `${id}.webp`)
  try {
    const item = await readItem(libPath, id)
    if (!item) return null
    const meta = await makeThumbnailFromBuffer(Buffer.from(bytes), join(libPath, thumbRel))
    item.thumbnail = thumbRel
    if (width) item.width = width
    if (height) item.height = height
    item.color = meta.color
    item.colors = meta.colors
    await saveItem(libPath, item)
    return item
  } catch {
    return null
  }
}

/**
 * Crop an image item to `region` (in EXIF-corrected pixel coordinates), overwrite
 * the original, and regenerate its thumbnail/dimensions/palette.
 */
export async function cropItem(
  id: string,
  region: { left: number; top: number; width: number; height: number }
): Promise<Item | null> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (!item) return null
    if (item.kind !== 'image') return null
    const srcAbs = originalAbs(libPath, item)

    // Clamp the region to the rotated (EXIF-applied) image bounds.
    const meta = await sharp(srcAbs, { failOn: 'none' }).rotate().metadata()
    const W = meta.width ?? 0
    const H = meta.height ?? 0
    const left = Math.max(0, Math.min(Math.round(region.left), Math.max(0, W - 1)))
    const top = Math.max(0, Math.min(Math.round(region.top), Math.max(0, H - 1)))
    const width = Math.max(1, Math.min(Math.round(region.width), W - left))
    const height = Math.max(1, Math.min(Math.round(region.height), H - top))

    const bucket = bucketFor(id)
    await fs.mkdir(join(libPath, bucket), { recursive: true })
    const crop = sharp(srcAbs, { failOn: 'none' }).rotate().extract({ left, top, width, height })
    if (item.linked) {
      // Never modify the external source: materialize the crop into the library.
      const destRel = join(bucket, `${id}.${item.ext}`)
      await crop.toFile(join(libPath, destRel))
      item.original = destRel
      item.linked = false
    } else {
      const tmp = `${srcAbs}.crop-tmp`
      await crop.toFile(tmp)
      await fs.rename(tmp, srcAbs)
    }

    const inLibAbs = join(libPath, item.original)
    const thumbRel = item.thumbnail || join(bucket, `${id}.webp`)
    const tmeta = await makeThumbnail(inLibAbs, join(libPath, thumbRel))
    item.thumbnail = thumbRel
    item.width = tmeta.width
    item.height = tmeta.height
    item.color = tmeta.color
    item.colors = tmeta.colors
    item.size = (await fs.stat(inLibAbs)).size
    item.dateModified = new Date().toISOString()
    await saveItem(libPath, item)
    return item
  } catch (err) {
    console.error(`Failed to crop item ${id}:`, err)
    return null
  }
}

/** Record that an item was just opened (drives the "Recently Used" view). */
export async function touchItem(id: string): Promise<Item | null> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (!item) return null
    item.lastUsedAt = new Date().toISOString()
    await saveItem(libPath, item)
    return item
  } catch {
    return null
  }
}

// ---------- smart folders (saved filters, stored in filters.json) ----------

export interface SmartFolder {
  id: string
  name: string
  filters: unknown
  createdAt: string
}

export async function listSmartFolders(): Promise<SmartFolder[]> {
  const libPath = requireCurrent()
  try {
    return await readJson<SmartFolder[]>(join(libPath, 'filters.json'))
  } catch {
    return []
  }
}

export async function createSmartFolder(name: string, filters: unknown): Promise<SmartFolder> {
  const libPath = requireCurrent()
  const list = await listSmartFolders()
  const sf: SmartFolder = {
    id: makeId(name),
    name: name.trim() || 'Smart Folder',
    filters,
    createdAt: new Date().toISOString()
  }
  list.push(sf)
  await writeJson(join(libPath, 'filters.json'), list)
  return sf
}

export async function deleteSmartFolder(id: string): Promise<SmartFolder[]> {
  const libPath = requireCurrent()
  const list = (await listSmartFolders()).filter((s) => s.id !== id)
  await writeJson(join(libPath, 'filters.json'), list)
  return list
}

// ---------- tags (canonical list stored in tags.json) ----------

export async function listTags(): Promise<string[]> {
  const libPath = requireCurrent()
  try {
    return await readJson<string[]>(join(libPath, 'tags.json'))
  } catch {
    return []
  }
}

export async function createTag(name: string): Promise<string[]> {
  const libPath = requireCurrent()
  const n = name.trim()
  const list = await listTags()
  if (n && !list.includes(n)) list.push(n)
  await writeJson(join(libPath, 'tags.json'), list)
  return list
}

export async function deleteTag(name: string): Promise<string[]> {
  const libPath = requireCurrent()
  const list = (await listTags()).filter((t) => t !== name)
  await writeJson(join(libPath, 'tags.json'), list)
  // also strip the tag from every item that had it
  for (const it of await readItemsAt(libPath)) {
    if ((it.tags ?? []).includes(name)) {
      it.tags = it.tags.filter((t) => t !== name)
      await saveItem(libPath, it)
    }
  }
  return list
}

// ---------- asset resolution (for the custom protocol) ----------

/** Resolve `asset://thumb/<id>` or `asset://original/<id>` to an absolute path. */
export async function resolveAsset(kind: 'thumb' | 'original', id: string): Promise<string | null> {
  const libPath = currentLibraryPath
  if (!libPath) return null
  // Guard against path traversal via a crafted id.
  if (!/^[a-z0-9-]+$/.test(id)) return null

  try {
    const item = await readItem(libPath, id)
    if (!item) return null
    if (kind === 'thumb') return item.thumbnail ? join(libPath, item.thumbnail) : null
    return item.original ? originalAbs(libPath, item) : null
  } catch {
    return null
  }
}

// ---------- text document read / write ----------

export async function readText(id: string): Promise<string | null> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (!item) return null
    return await fs.readFile(originalAbs(libPath, item), 'utf-8')
  } catch {
    return null
  }
}

export async function writeText(id: string, content: string): Promise<Item | null> {
  const libPath = requireCurrent()
  try {
    const item = await readItem(libPath, id)
    if (!item) return null
    const abs = originalAbs(libPath, item)
    await fs.writeFile(abs, content, 'utf-8')
    const st = await fs.stat(abs)
    item.size = st.size
    item.dateModified = new Date().toISOString()
    await saveItem(libPath, item)
    return item
  } catch {
    return null
  }
}
