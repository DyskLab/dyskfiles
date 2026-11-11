// Ambient types shared between preload and renderer.

interface RakLibrary {
  name: string
  icon: string
  version: number
  createdAt: string
  itemCount: number
  path: string
}

interface RakKnownLibrary {
  path: string
  name: string
  icon: string
  available: boolean
}

interface RakContextResult {
  action: 'icon' | 'reveal' | 'merge' | 'remove' | 'delete'
  path: string
  target?: string
  count?: number
}

type RakItemKind = 'image' | 'text' | 'video' | 'audio' | 'pdf' | 'font'

interface RakItem {
  id: string
  name: string
  ext: string
  kind: RakItemKind
  size: number
  width: number
  height: number
  importedAt: string
  dateModified: string
  dateCreated: string
  rating: number
  duration: number | null
  color: string | null
  colors: string[]
  comment: string
  note: string
  url: string
  order: number
  original: string
  thumbnail: string
  tags: string[]
  folderIds: string[]
  lastUsedAt: string | null
  deletedAt: string | null
  linked: boolean
  eagleId?: string
  dhash?: string
}

interface RakUpdateInfo {
  version: string
  current: string
  notes: string
  page: string
  asset: { name: string; url: string; size: number; digest?: string }
}

interface RakEagleResult {
  imported: number
  unsupported: number
  missing: number
  already: number
  folders: number
}

interface RakFolder {
  id: string
  name: string
  createdAt: string
}

type RakItemPatch = Partial<
  Pick<RakItem, 'name' | 'rating' | 'comment' | 'note' | 'url' | 'tags' | 'folderIds' | 'duration'>
>

interface RakSmartFolder {
  id: string
  name: string
  filters: unknown
  createdAt: string
}

interface RakApi {
  /** process.platform, for platform-specific labels (Finder vs Explorer, ⌘ vs Ctrl). */
  platform: string
  /** Reopen the last-used library on launch (null if none / missing). */
  getCurrentLibrary(): Promise<RakLibrary | null>
  /** All libraries the app knows about, most-recent first. */
  listLibraries(): Promise<RakKnownLibrary[]>
  /** Pick a parent folder and create `<name>.dyskfiles` inside it. */
  createLibrary(name: string): Promise<RakLibrary | null>
  /** Pick an existing `.dyskfiles` folder and open it. */
  openLibrary(): Promise<RakLibrary | null>
  /** Switch to a known library by its path. */
  switchLibrary(path: string): Promise<RakLibrary | null>
  /** Remove a library from the known list (files are left on disk). */
  forgetLibrary(path: string): Promise<RakKnownLibrary[]>
  /** Change a library's display icon. */
  setLibraryIcon(path: string, icon: string): Promise<void>
  /** Copy every item from one library into another. Returns items merged. */
  mergeLibrary(sourcePath: string, targetPath: string): Promise<number>
  /** Reveal a library folder in the OS file manager. */
  revealLibrary(path: string): Promise<void>
  /** Rebuild all thumbnails for the current library; returns the refreshed items. */
  rebuildThumbnails(): Promise<RakItem[]>
  /** Check the library and offer to repair it; true when something was repaired. */
  checkLibrary(): Promise<boolean>
  /** The update found this session, if any. */
  latestUpdate(): Promise<RakUpdateInfo | null>
  /** "Check for Updates…": the main process reports the result itself. */
  checkForUpdates(): Promise<void>
  skipUpdate(version: string): Promise<void>
  /** Download and open the update's DMG; resolves to its path. */
  downloadUpdate(): Promise<string>
  quitForUpdate(): Promise<void>
  onUpdateAvailable(cb: (info: RakUpdateInfo) => void): () => void
  onUpdateProgress(cb: (p: { received: number; total: number }) => void): () => void
  /** Show the native per-library context menu; resolves with the chosen action. */
  libraryContextMenu(path: string): Promise<RakContextResult | null>
  /** Active (non-trashed) items in the current library. */
  listItems(): Promise<RakItem[]>
  /** Trashed items in the current library, most-recently-deleted first. */
  listTrash(): Promise<RakItem[]>
  /** Import via a native file picker. `linked` references files in place (no copy). */
  importDialog(linked?: boolean): Promise<RakItem[]>
  /** Import a folder (walked recursively). `linked` references files in place (no copy). */
  importFolder(linked?: boolean): Promise<RakItem[]>
  /** Import by absolute paths (drag-and-drop). `linked` references files in place (no copy). */
  importPaths(paths: string[], linked?: boolean): Promise<RakItem[]>
  /** Download a file from a URL and import it. */
  importUrl(url: string): Promise<RakItem[]>
  /** Find duplicate items (grouped by content hash); groups have 2+ items. */
  findDuplicates(): Promise<RakItem[][]>
  /** Move an item to the trash (soft delete). */
  trashItem(id: string): Promise<void>
  /** Restore an item from the trash. */
  restoreItem(id: string): Promise<void>
  /** Permanently delete a single item and its files. */
  deleteItemForever(id: string): Promise<void>
  /** Permanently delete all trashed items; returns how many were removed. */
  emptyTrash(): Promise<number>
  /** Persist a new manual ordering of items by id. */
  reorderItems(orderedIds: string[]): Promise<void>
  /** Update item metadata (rating, tags, folder, comment, note, url). */
  updateItem(id: string, patch: RakItemPatch): Promise<RakItem | null>
  /** Mark an item as just opened (drives the Recently Used view). */
  touchItem(id: string): Promise<RakItem | null>
  /** Save a renderer-captured thumbnail (e.g. a video poster) for an item. */
  setItemThumbnail(
    id: string,
    bytes: Uint8Array,
    width: number,
    height: number
  ): Promise<RakItem | null>
  /** Crop an image item to a pixel region (overwrites the original). */
  cropItem(
    id: string,
    region: { left: number; top: number; width: number; height: number }
  ): Promise<RakItem | null>
  /** Read a text item's file contents. */
  readText(id: string): Promise<string | null>
  /** Overwrite a text item's file contents; returns the updated item. */
  writeText(id: string, content: string): Promise<RakItem | null>
  /** Reveal an item's original file in the OS file manager. */
  revealItem(id: string): Promise<void>
  /** Export (copy) an item's original file to a chosen location. */
  exportItem(id: string, filename: string): Promise<boolean>
  /** Export items into a new folder (chosen by the user) with metadata.json and metadata.csv. */
  exportItems(ids: string[], title: string): Promise<boolean>
  /** Folders in the current library. */
  listFolders(): Promise<RakFolder[]>
  createFolder(name: string): Promise<RakFolder>
  renameFolder(id: string, name: string): Promise<RakFolder[]>
  deleteFolder(id: string): Promise<RakFolder[]>
  /** Smart folders (saved filters). */
  listSmartFolders(): Promise<RakSmartFolder[]>
  createSmartFolder(name: string, filters: unknown): Promise<RakSmartFolder>
  deleteSmartFolder(id: string): Promise<RakSmartFolder[]>
  /** Canonical tag list. */
  listTags(): Promise<string[]>
  createTag(name: string): Promise<string[]>
  deleteTag(name: string): Promise<string[]>
  /** Persisted UI preferences (filters, sort, layout, view options). */
  getPrefs(): Promise<Record<string, unknown>>
  setPrefs(patch: Record<string, unknown>): Promise<void>
  /** Resolve a dropped File to its absolute path on disk. */
  getPathForFile(file: File): string
  /** Open an item in its default app and watch it for saves; resolves with an error message or null. */
  openItemExternally(id: string): Promise<string | null>
  /** Groups of visually similar images/videos (thumbnail hashes within `maxDistance` of 64 bits). */
  findSimilar(maxDistance?: number): Promise<RakItem[][]>
  /** Pick an Eagle library, confirm, and import it. Null when cancelled. */
  importEagle(): Promise<RakEagleResult | null>
  /** Watched folders whose new files are imported automatically. */
  listWatched(): Promise<string[]>
  /** Pick a folder to watch; resolves with the updated list. */
  addWatched(): Promise<string[]>
  removeWatched(dir: string): Promise<string[]>
  /** Progress of a running Eagle import. Returns an unsubscribe function. */
  onEagleProgress(cb: (p: { done: number; total: number }) => void): () => void
  /** An item changed on disk (saved from another app). Returns an unsubscribe function. */
  onItemsChanged(cb: (item: RakItem) => void): () => void
  /** Items were imported in the background (watched folders). Returns an unsubscribe function. */
  onItemsAdded(cb: (items: RakItem[]) => void): () => void
}

interface Window {
  rak: RakApi
}
