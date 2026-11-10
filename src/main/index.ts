import { app, BrowserWindow, dialog, ipcMain, Menu, nativeImage, protocol, shell } from 'electron'
import { createReadStream, promises as fs } from 'fs'
import { Readable } from 'stream'
import { APP_ICON_DATA_URL } from './appIcon'
import os from 'os'
import { basename, extname, join } from 'path'
import { readConfig, rememberLibrary, forgetLibrary, readPrefs, writePrefs } from './config'
import {
  createFolder,
  createLibrary,
  createSmartFolder,
  createTag,
  deleteFolder,
  deleteSmartFolder,
  deleteTag,
  listSmartFolders,
  listTags,
  deleteItemForever,
  deleteLibraryFiles,
  emptyTrash,
  getCurrentPath,
  importPaths,
  listFolders,
  listItems,
  listTrash,
  mergeInto,
  openLibrary,
  rebuildThumbnails,
  renameFolder,
  reorderItems,
  resolveAsset,
  restoreItem,
  setIcon,
  trashItem,
  tryOpen,
  updateItem,
  touchItem,
  setItemThumbnail,
  cropItem,
  readText,
  writeText,
  DEFAULT_ICON,
  IMAGE_EXTS,
  VIDEO_EXTS,
  AUDIO_EXTS,
  PDF_EXTS,
  FONT_EXTS,
  TEXT_EXTS,
  SUPPORTED_EXTS,
  findDuplicates,
  findSimilar,
  surveyEagle,
  importEagle,
  listWatched,
  addWatched,
  removeWatched,
  type Library
} from './library'
import { refreshFolderWatchers, stopWatchers, syncWatchers, watchItem } from './watcher'

// The custom scheme must be registered before the app is ready.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tiff': 'image/tiff',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.opus': 'audio/opus',
  '.pdf': 'application/pdf',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
}

const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/ogg': '.ogg',
  'application/pdf': '.pdf',
  'font/ttf': '.ttf',
  'font/otf': '.otf',
  'font/woff': '.woff',
  'font/woff2': '.woff2',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'application/json': '.json',
  'text/html': '.html',
  'text/css': '.css',
  'text/javascript': '.js',
  'application/javascript': '.js'
}

// Brand app icon, embedded as a data URL so it survives the
// build and needs no external file.
let appIcon: Electron.NativeImage | null = null
function buildAppIcon(): Electron.NativeImage | null {
  if (appIcon) return appIcon
  try {
    const img = nativeImage.createFromDataURL(APP_ICON_DATA_URL)
    appIcon = img.isEmpty() ? null : img
  } catch (err) {
    console.error('Failed to build app icon:', err)
    appIcon = null
  }
  return appIcon
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#1a1a1e',
    ...(appIcon ? { icon: appIcon } : {}),
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    // Lower the traffic lights so they vertically center in the 56px top strip.
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 20, y: 21 } } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The preload only needs `electron` (contextBridge, ipcRenderer, webUtils),
      // all of which a sandboxed preload can use.
      sandbox: true
    }
  })

  win.once('ready-to-show', () => win.show())

  // Links such as the support page open in the default browser, not in a new app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Dev utility: DYSKFILES_SHOT=<path> captures the window to a PNG then quits.
  // Optionally DYSKFILES_SHOT_CLICK=<css selector> is clicked first (e.g. to open a menu).
  if (process.env.DYSKFILES_SHOT) {
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          if (process.env.DYSKFILES_SHOT_CLICK) {
            // '|'-separated selectors clicked in sequence. Prefix 'dbl:' to double-click.
            for (const raw of process.env.DYSKFILES_SHOT_CLICK.split('|')) {
              const dbl = raw.startsWith('dbl:')
              const isJs = raw.startsWith('js:')
              const sel = dbl ? raw.slice(4) : raw
              await win.webContents.executeJavaScript(
                isJs
                  ? raw.slice(3)
                  : dbl
                    ? `document.querySelector(${JSON.stringify(sel)})?.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`
                    : `document.querySelector(${JSON.stringify(sel)})?.click()`
              )
              await new Promise((r) => setTimeout(r, 500))
            }
          }
          if (process.env.DYSKFILES_SHOT_SCROLL) {
            await win.webContents.executeJavaScript(
              `(() => { const el = document.querySelector('.grid-wrap'); if (el) el.scrollTop = ${Number(process.env.DYSKFILES_SHOT_SCROLL)}; return el ? el.scrollTop : -1 })()`
            )
            await new Promise((r) => setTimeout(r, 250))
          }
          const img = await win.webContents.capturePage()
          await fs.writeFile(process.env.DYSKFILES_SHOT as string, img.toPNG())
        } finally {
          app.quit()
        }
      }, 1800)
    })
  }

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/**
 * Parse a single `Range: bytes=…` header against a file of `size` bytes.
 * Supports `start-end`, `start-` and the suffix form `-n` (last n bytes).
 * Returns null when the range cannot be satisfied (→ 416).
 */
function parseRange(header: string, size: number): { start: number; end: number } | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.split(',')[0].trim())
  if (!m || (!m[1] && !m[2]) || size === 0) return null
  let start: number
  let end: number
  if (!m[1]) {
    // Suffix range: the last n bytes.
    const n = parseInt(m[2], 10)
    if (n === 0) return null
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = parseInt(m[1], 10)
    end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1
  }
  if (start >= size || start > end) return null
  return { start, end }
}

/** Stream bytes [start, end] of a file, so large media never sits whole in memory. */
function streamFile(filePath: string, start: number, end: number): ReadableStream {
  return Readable.toWeb(createReadStream(filePath, { start, end })) as ReadableStream
}

function registerAssetProtocol(): void {
  protocol.handle('asset', async (request) => {
    const url = new URL(request.url) // asset://<kind>/<id>
    const kind = url.hostname === 'original' ? 'original' : 'thumb'
    const id = decodeURIComponent(url.pathname.replace(/^\//, ''))

    const filePath = await resolveAsset(kind, id)
    if (!filePath) return new Response('Not found', { status: 404 })

    try {
      const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      const stat = await fs.stat(filePath)
      const range = request.headers.get('range')

      // Range requests (video/audio seeking) → 206 Partial Content.
      if (range) {
        const r = parseRange(range, stat.size)
        if (!r) {
          return new Response(null, {
            status: 416,
            headers: { 'Content-Range': `bytes */${stat.size}` }
          })
        }
        return new Response(streamFile(filePath, r.start, r.end), {
          status: 206,
          headers: {
            'Content-Type': mime,
            'Content-Range': `bytes ${r.start}-${r.end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(r.end - r.start + 1)
          }
        })
      }

      return new Response(stat.size ? streamFile(filePath, 0, stat.size - 1) : null, {
        headers: {
          'Content-Type': mime,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(stat.size)
        }
      })
    } catch {
      return new Response('Not found', { status: 404 })
    }
  })
}

// ---------- IPC ----------

interface KnownLibrary {
  path: string
  name: string
  icon: string
  available: boolean
}

async function knownLibraries(): Promise<KnownLibrary[]> {
  const { libraries } = await readConfig()
  return Promise.all(
    libraries.map(async (ref) => {
      try {
        // Read fresh name/icon so edits (e.g. icon changes) show immediately.
        const meta = JSON.parse(await fs.readFile(join(ref.path, 'library.json'), 'utf-8'))
        return {
          path: ref.path,
          name: meta.name ?? ref.name,
          icon: meta.icon ?? ref.icon ?? DEFAULT_ICON,
          available: true
        }
      } catch {
        return {
          path: ref.path,
          name: ref.name,
          icon: ref.icon ?? DEFAULT_ICON,
          available: false
        }
      }
    })
  )
}

function registerIpc(): void {
  ipcMain.handle('library:getCurrent', async (): Promise<Library | null> => {
    const { lastLibraryPath } = await readConfig()
    const lib = await tryOpen(lastLibraryPath)
    // Seed the known-list from a pre-existing config (migration) and keep it fresh.
    if (lib) await rememberLibrary({ path: lib.path, name: lib.name, icon: lib.icon })
    await syncWatchers()
    return lib
  })

  ipcMain.handle('library:known', () => knownLibraries())

  ipcMain.handle('library:create', async (_e, name: string): Promise<Library | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose where to create the library',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    const lib = await createLibrary(result.filePaths[0], name)
    await rememberLibrary({ path: lib.path, name: lib.name, icon: lib.icon })
    await syncWatchers()
    return lib
  })

  ipcMain.handle('library:open', async (): Promise<Library | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Open a library folder',
      properties: ['openDirectory']
    })
    if (result.canceled || !result.filePaths[0]) return null
    try {
      const lib = await openLibrary(result.filePaths[0])
      await rememberLibrary({ path: lib.path, name: lib.name, icon: lib.icon })
      await syncWatchers()
      return lib
    } catch {
      await dialog.showErrorBox('Not a DyskFiles library', 'The chosen folder has no library.json.')
      return null
    }
  })

  ipcMain.handle('library:switch', async (_e, path: string): Promise<Library | null> => {
    try {
      const lib = await openLibrary(path)
      await rememberLibrary({ path: lib.path, name: lib.name, icon: lib.icon })
      await syncWatchers()
      return lib
    } catch {
      await dialog.showErrorBox('Library not found', 'This library could not be opened. It may have been moved or deleted.')
      return null
    }
  })

  ipcMain.handle('library:forget', (_e, path: string) => forgetLibrary(path).then(() => knownLibraries()))

  ipcMain.handle('items:importDialog', async (_e, linked = false) => {
    if (!getCurrentPath()) return []
    const result = await dialog.showOpenDialog({
      title: linked ? 'Link files (reference in place)' : 'Import files',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'All supported', extensions: SUPPORTED_EXTS.map((e) => e.slice(1)) },
        { name: 'Images', extensions: IMAGE_EXTS.map((e) => e.slice(1)) },
        { name: 'Video', extensions: VIDEO_EXTS.map((e) => e.slice(1)) },
        { name: 'Audio', extensions: AUDIO_EXTS.map((e) => e.slice(1)) },
        { name: 'PDF', extensions: PDF_EXTS.map((e) => e.slice(1)) },
        { name: 'Fonts', extensions: FONT_EXTS.map((e) => e.slice(1)) },
        { name: 'Text', extensions: TEXT_EXTS.map((e) => e.slice(1)) }
      ]
    })
    if (result.canceled) return []
    return importPaths(result.filePaths, null, linked)
  })

  ipcMain.handle('items:importPaths', (_e, paths: string[], linked = false) =>
    importPaths(paths ?? [], null, linked)
  )

  // Download a file from a URL and import it.
  ipcMain.handle('items:importUrl', async (_e, url: string) => {
    if (!getCurrentPath()) return []
    try {
      const res = await fetch(url)
      if (!res.ok) return []
      const buf = Buffer.from(await res.arrayBuffer())
      let pathname = ''
      try {
        pathname = new URL(url).pathname
      } catch {
        return []
      }
      let ext = extname(pathname).toLowerCase()
      if (!SUPPORTED_EXTS.includes(ext)) {
        const ct = (res.headers.get('content-type') ?? '').split(';')[0].trim()
        ext = MIME_TO_EXT[ct] ?? ''
      }
      if (!SUPPORTED_EXTS.includes(ext)) return []
      const rawName = basename(pathname) || `download${ext}`
      const fname = rawName.toLowerCase().endsWith(ext) ? rawName : `${rawName}${ext}`
      const dir = await fs.mkdtemp(join(os.tmpdir(), 'dyskfiles-dl-'))
      const tmp = join(dir, fname)
      await fs.writeFile(tmp, buf)
      const items = await importPaths([tmp])
      await fs.rm(dir, { recursive: true, force: true })
      return items
    } catch {
      return []
    }
  })

  ipcMain.handle('items:findDuplicates', () => (getCurrentPath() ? findDuplicates() : []))
  ipcMain.handle('items:findSimilar', (_e, maxDistance?: number) =>
    getCurrentPath() ? findSimilar(maxDistance) : []
  )

  // Open an item in the app that owns its file type, and watch it for saves.
  ipcMain.handle('items:openExternal', async (_e, id: string): Promise<string | null> => {
    const abs = await resolveAsset('original', id)
    if (!abs) return 'File not found'
    const err = await shell.openPath(abs)
    if (!err) await watchItem(id, abs)
    return err || null
  })

  // Import an Eagle library (read-only): pick the .library folder, confirm, import.
  ipcMain.handle('eagle:import', async (e) => {
    if (!getCurrentPath()) return null
    const win = BrowserWindow.fromWebContents(e.sender)
    const pick = await dialog.showOpenDialog({
      title: 'Choose an Eagle library (.library folder)',
      properties: ['openDirectory']
    })
    if (pick.canceled || !pick.filePaths[0]) return null
    let survey
    try {
      survey = await surveyEagle(pick.filePaths[0])
    } catch (err) {
      dialog.showErrorBox('Not an Eagle library', (err as Error).message)
      return null
    }
    const skip = survey.items - survey.supported
    const opts = {
      type: 'question' as const,
      buttons: ['Cancel', 'Import'],
      defaultId: 1,
      cancelId: 0,
      message: `Import "${survey.name}" from Eagle?`,
      detail:
        `${survey.supported} of ${survey.items} items can be imported` +
        (skip ? ` (${skip} are file types DyskFiles does not support yet)` : '') +
        `, with ${survey.folders} folders. Files are copied; the Eagle library is not changed.`
    }
    const { response } = win ? await dialog.showMessageBox(win, opts) : await dialog.showMessageBox(opts)
    if (response !== 1) return null
    let last = 0
    const result = await importEagle(survey.path, (done, total) => {
      const now = Date.now()
      if (now - last > 150 || done === total) {
        last = now
        e.sender.send('eagle:progress', { done, total })
      }
    })
    const lines = [`${result.imported.length} items imported, ${result.folders} new folders.`]
    if (result.already) lines.push(`${result.already} were already in this library and were skipped.`)
    if (result.unsupported) lines.push(`${result.unsupported} have a file type DyskFiles does not support yet.`)
    if (result.missing) lines.push(`${result.missing} could not be read (file missing or damaged).`)
    const done = { type: 'info' as const, message: 'Eagle import finished', detail: lines.join('\n') }
    if (win) await dialog.showMessageBox(win, done)
    else await dialog.showMessageBox(done)
    return {
      imported: result.imported.length,
      unsupported: result.unsupported,
      missing: result.missing,
      already: result.already,
      folders: result.folders
    }
  })

  // Watched folders (auto import).
  ipcMain.handle('watch:list', () => (getCurrentPath() ? listWatched() : []))
  ipcMain.handle('watch:add', async () => {
    if (!getCurrentPath()) return []
    const pick = await dialog.showOpenDialog({
      title: 'Choose a folder to watch',
      properties: ['openDirectory', 'createDirectory']
    })
    if (pick.canceled || !pick.filePaths[0]) return listWatched()
    try {
      const list = await addWatched(pick.filePaths[0])
      await refreshFolderWatchers()
      return list
    } catch (err) {
      dialog.showErrorBox('Cannot watch this folder', (err as Error).message)
      return listWatched()
    }
  })
  ipcMain.handle('watch:remove', async (_e, dir: string) => {
    if (!getCurrentPath()) return []
    const list = await removeWatched(dir)
    await refreshFolderWatchers()
    return list
  })

  ipcMain.handle('items:importFolder', async (_e, linked = false) => {
    if (!getCurrentPath()) return []
    const result = await dialog.showOpenDialog({
      title: linked ? 'Link a folder (reference in place)' : 'Import a folder of images',
      properties: ['openDirectory', 'multiSelections']
    })
    if (result.canceled) return []
    return importPaths(result.filePaths, null, linked) // folders are walked recursively
  })

  ipcMain.handle('items:list', () => listItems())
  ipcMain.handle('items:listTrash', () => listTrash())
  ipcMain.handle('items:trash', (_e, id: string) => trashItem(id))
  ipcMain.handle('items:restore', (_e, id: string) => restoreItem(id))
  ipcMain.handle('items:deleteForever', (_e, id: string) => deleteItemForever(id))
  ipcMain.handle('items:emptyTrash', () => emptyTrash())

  ipcMain.handle('items:reorder', (_e, orderedIds: string[]) => reorderItems(orderedIds ?? []))
  ipcMain.handle('items:update', (_e, id: string, patch: unknown) => updateItem(id, patch as never))
  ipcMain.handle('items:touch', (_e, id: string) => touchItem(id))
  ipcMain.handle(
    'items:setThumbnail',
    (_e, id: string, bytes: Uint8Array, width: number, height: number) =>
      setItemThumbnail(id, bytes, width, height)
  )
  ipcMain.handle(
    'items:crop',
    (_e, id: string, region: { left: number; top: number; width: number; height: number }) =>
      cropItem(id, region)
  )
  ipcMain.handle('items:readText', (_e, id: string) => readText(id))
  ipcMain.handle('items:writeText', (_e, id: string, content: string) => writeText(id, content))

  ipcMain.handle('folders:list', () => listFolders())
  ipcMain.handle('folders:create', (_e, name: string) => createFolder(name))
  ipcMain.handle('folders:rename', (_e, id: string, name: string) => renameFolder(id, name))
  ipcMain.handle('folders:delete', (_e, id: string) => deleteFolder(id))

  ipcMain.handle('smart:list', () => listSmartFolders())
  ipcMain.handle('smart:create', (_e, name: string, filters: unknown) => createSmartFolder(name, filters))
  ipcMain.handle('smart:delete', (_e, id: string) => deleteSmartFolder(id))

  ipcMain.handle('tags:list', () => listTags())
  ipcMain.handle('tags:create', (_e, name: string) => createTag(name))
  ipcMain.handle('tags:delete', (_e, name: string) => deleteTag(name))

  ipcMain.handle('prefs:get', () => readPrefs())
  ipcMain.handle('prefs:set', (_e, patch: Record<string, unknown>) => writePrefs(patch))

  ipcMain.handle('items:reveal', async (_e, id: string) => {
    const abs = await resolveAsset('original', id)
    if (abs) shell.showItemInFolder(abs)
  })

  ipcMain.handle('items:export', async (_e, id: string, filename: string) => {
    const abs = await resolveAsset('original', id)
    if (!abs) return false
    const res = await dialog.showSaveDialog({ title: 'Export', defaultPath: filename || basename(abs) })
    if (res.canceled || !res.filePath) return false
    await fs.copyFile(abs, res.filePath)
    return true
  })

  // Regenerate all thumbnails, then hand back the fresh item list.
  ipcMain.handle('library:rebuildThumbnails', async () => {
    await rebuildThumbnails()
    return listItems()
  })

  ipcMain.handle('library:setIcon', (_e, path: string, icon: string) => setIcon(path, icon))

  ipcMain.handle('library:merge', (_e, sourcePath: string, targetPath: string) =>
    mergeInto(sourcePath, targetPath)
  )

  ipcMain.handle('library:reveal', (_e, path: string) => {
    shell.showItemInFolder(path)
  })

  // Right-click / “⋯” menu for a single library in the switcher.
  ipcMain.handle('library:contextMenu', async (_e, path: string) => {
    const win = BrowserWindow.fromWebContents(_e.sender) ?? undefined
    const { libraries } = await readConfig()
    const others = libraries.filter((l) => l.path !== path)

    return new Promise<{ action: string; path: string; target?: string; count?: number } | null>(
      (resolve) => {
        let intent: { action: string; icon?: string; target?: string } | null = null

        // Keys must match the icon names in the renderer's Icon.svelte set.
        const ICON_CHOICES: { key: string; label: string }[] = [
          { key: 'chicken', label: 'Chicken' },
          { key: 'folder', label: 'Folder' },
          { key: 'image', label: 'Image' },
          { key: 'grid', label: 'Grid' },
          { key: 'camera', label: 'Camera' },
          { key: 'star', label: 'Star' },
          { key: 'flame', label: 'Flame' },
          { key: 'bookmark', label: 'Bookmark' },
          { key: 'heart', label: 'Heart' },
          { key: 'box', label: 'Box' },
          { key: 'palette', label: 'Palette' },
          { key: 'moon', label: 'Moon' }
        ]
        const template: Electron.MenuItemConstructorOptions[] = [
          {
            label: 'Change Icon',
            submenu: ICON_CHOICES.map(({ key, label }) => ({
              label,
              click: () => (intent = { action: 'icon', icon: key })
            }))
          },
          { label: 'Reveal in Finder', click: () => (intent = { action: 'reveal' }) },
          { type: 'separator' },
          {
            label: 'Merge Into',
            enabled: others.length > 0,
            submenu:
              others.length > 0
                ? others.map((o) => ({
                    label: o.name,
                    click: () => (intent = { action: 'merge', target: o.path })
                  }))
                : [{ label: 'No other libraries', enabled: false }]
          },
          { type: 'separator' },
          { label: 'Remove from List', click: () => (intent = { action: 'remove' }) },
          { label: 'Delete from Disk…', click: () => (intent = { action: 'delete' }) }
        ]

        const menu = Menu.buildFromTemplate(template)
        menu.popup({
          window: win,
          callback: async () => {
            if (!intent) return resolve(null)
            try {
              switch (intent.action) {
                case 'icon':
                  await setIcon(path, intent.icon as string)
                  return resolve({ action: 'icon', path })
                case 'reveal':
                  shell.showItemInFolder(path)
                  return resolve({ action: 'reveal', path })
                case 'merge': {
                  const count = await mergeInto(path, intent.target as string)
                  return resolve({ action: 'merge', path, target: intent.target, count })
                }
                case 'remove':
                  await forgetLibrary(path)
                  return resolve({ action: 'remove', path })
                case 'delete': {
                  const opts: Electron.MessageBoxOptions = {
                    type: 'warning',
                    buttons: ['Cancel', 'Delete'],
                    defaultId: 0,
                    cancelId: 0,
                    message: 'Delete this library from disk?',
                    detail:
                      'This permanently removes the library folder and all its files. This cannot be undone.'
                  }
                  const { response } = win
                    ? await dialog.showMessageBox(win, opts)
                    : await dialog.showMessageBox(opts)
                  if (response !== 1) return resolve(null)
                  await deleteLibraryFiles(path)
                  await syncWatchers()
                  await forgetLibrary(path)
                  return resolve({ action: 'delete', path })
                }
                default:
                  return resolve(null)
              }
            } catch (err) {
              console.error('context menu action failed:', err)
              return resolve(null)
            }
          }
        })
      }
    )
  })
}

app.whenReady().then(async () => {
  const icon = buildAppIcon()
  if (icon && process.platform === 'darwin') app.dock?.setIcon(icon)
  registerAssetProtocol()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', () => stopWatchers())

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
