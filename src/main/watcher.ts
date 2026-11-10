import { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'fs'
import { basename, dirname } from 'path'
import {
  fileStamp,
  getCurrentPath,
  importFromWatched,
  listWatched,
  refreshItemFromDisk,
  type FileStamp,
  type Item
} from './library'

/**
 * File-system watching for the open library:
 *
 * - Items opened in another app are watched, so a save there redraws the item
 *   here (`items:changed`).
 * - Watched folders are scanned whenever something in them changes, and new
 *   files are imported (`items:added`).
 *
 * Everything is torn down when the library changes, and every callback checks
 * that the library it was set up for is still the open one.
 */

let activeLib: string | null = null

// Item watchers: one directory watcher per parent folder, shared by the files in it.
// Editors often save by writing a temp file and renaming it over the original,
// which a watcher on the file itself would lose track of.
const dirWatchers = new Map<string, { watcher: FSWatcher; files: Map<string, string> }>()
const itemTimers = new Map<string, NodeJS.Timeout>()
// The file as it was when watching began (or after the last refresh).
const stamps = new Map<string, FileStamp>()

let folderWatchers: FSWatcher[] = []
let scanTimer: NodeJS.Timeout | null = null
let scanning = false
let rescan = false

function send(channel: string, payload: unknown): void {
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send(channel, payload)
}

function stillActive(lib: string | null): boolean {
  return lib !== null && lib === activeLib && getCurrentPath() === lib
}

/** Watch an item's original so edits made in another app are picked up. */
export async function watchItem(id: string, filePath: string): Promise<void> {
  const lib = activeLib
  if (!lib) return
  if (!stamps.has(id)) {
    const stamp = await fileStamp(id)
    if (!stamp || !stillActive(lib)) return
    stamps.set(id, stamp)
  }
  const dir = dirname(filePath)
  const name = basename(filePath)
  let entry = dirWatchers.get(dir)
  if (!entry) {
    const files = new Map<string, string>()
    let watcher: FSWatcher
    try {
      watcher = watch(dir, (_event, changed) => {
        const fname = changed?.toString()
        const itemId = fname ? files.get(fname) : undefined
        if (!itemId) return
        clearTimeout(itemTimers.get(itemId))
        itemTimers.set(
          itemId,
          setTimeout(async () => {
            itemTimers.delete(itemId)
            const since = stamps.get(itemId)
            if (!since || !stillActive(lib)) return
            const item = await refreshItemFromDisk(itemId, since).catch(() => null)
            if (!item || !stillActive(lib)) return
            const now = await fileStamp(itemId)
            if (now) stamps.set(itemId, now)
            send('items:changed', item)
          }, 400)
        )
      })
    } catch (err) {
      console.error(`Cannot watch ${dir}:`, err)
      return
    }
    entry = { watcher, files }
    dirWatchers.set(dir, entry)
  }
  entry.files.set(name, id)
}

async function scanWatchedFolders(lib: string): Promise<void> {
  if (scanning) {
    rescan = true
    return
  }
  scanning = true
  try {
    do {
      rescan = false
      if (!stillActive(lib)) return
      const { imported, pending } = await importFromWatched()
      if (!stillActive(lib)) return
      if (imported.length) send('items:added', imported satisfies Item[])
      // Files still being written: look again once they have settled.
      if (pending) scheduleScan(lib, 2000)
    } while (rescan)
  } catch (err) {
    console.error('Auto import failed:', err)
  } finally {
    scanning = false
  }
}

function scheduleScan(lib: string, delay = 1000): void {
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = setTimeout(() => {
    scanTimer = null
    void scanWatchedFolders(lib)
  }, delay)
}

function stopAll(): void {
  for (const { watcher } of dirWatchers.values()) watcher.close()
  dirWatchers.clear()
  for (const t of itemTimers.values()) clearTimeout(t)
  itemTimers.clear()
  stamps.clear()
  for (const w of folderWatchers) w.close()
  folderWatchers = []
  if (scanTimer) clearTimeout(scanTimer)
  scanTimer = null
}

/** Restart folder watchers for the current watched-folder list. */
export async function refreshFolderWatchers(): Promise<void> {
  const lib = activeLib
  for (const w of folderWatchers) w.close()
  folderWatchers = []
  if (!lib) return
  for (const dir of await listWatched()) {
    try {
      folderWatchers.push(watch(dir, { recursive: true }, () => scheduleScan(lib)))
    } catch (err) {
      console.error(`Cannot watch folder ${dir}:`, err)
    }
  }
  // Catch up on anything that arrived while the app was closed.
  if (folderWatchers.length) scheduleScan(lib, 0)
}

/** Call after the open library changes (or is first opened). */
export async function syncWatchers(): Promise<void> {
  const current = getCurrentPath()
  if (current === activeLib) return
  stopAll()
  activeLib = current
  await refreshFolderWatchers()
}

export function stopWatchers(): void {
  stopAll()
  activeLib = null
}
