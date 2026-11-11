import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api: RakApi = {
  platform: process.platform,
  getCurrentLibrary: () => ipcRenderer.invoke('library:getCurrent'),
  listLibraries: () => ipcRenderer.invoke('library:known'),
  createLibrary: (name) => ipcRenderer.invoke('library:create', name),
  openLibrary: () => ipcRenderer.invoke('library:open'),
  switchLibrary: (path) => ipcRenderer.invoke('library:switch', path),
  forgetLibrary: (path) => ipcRenderer.invoke('library:forget', path),
  setLibraryIcon: (path, icon) => ipcRenderer.invoke('library:setIcon', path, icon),
  mergeLibrary: (sourcePath, targetPath) =>
    ipcRenderer.invoke('library:merge', sourcePath, targetPath),
  revealLibrary: (path) => ipcRenderer.invoke('library:reveal', path),
  rebuildThumbnails: () => ipcRenderer.invoke('library:rebuildThumbnails'),
  checkLibrary: (): Promise<boolean> => ipcRenderer.invoke('library:check'),
  latestUpdate: () => ipcRenderer.invoke('update:latest'),
  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  skipUpdate: (version: string) => ipcRenderer.invoke('update:skip', version),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  quitForUpdate: () => ipcRenderer.invoke('update:quit'),
  onUpdateAvailable: (cb) => subscribe('update:available', cb),
  onUpdateProgress: (cb) => subscribe('update:progress', cb),
  libraryContextMenu: (path) => ipcRenderer.invoke('library:contextMenu', path),
  listItems: () => ipcRenderer.invoke('items:list'),
  listTrash: () => ipcRenderer.invoke('items:listTrash'),
  importDialog: (linked) => ipcRenderer.invoke('items:importDialog', linked),
  importFolder: (linked) => ipcRenderer.invoke('items:importFolder', linked),
  importPaths: (paths, linked) => ipcRenderer.invoke('items:importPaths', paths, linked),
  importUrl: (url) => ipcRenderer.invoke('items:importUrl', url),
  findDuplicates: () => ipcRenderer.invoke('items:findDuplicates'),
  trashItem: (id) => ipcRenderer.invoke('items:trash', id),
  restoreItem: (id) => ipcRenderer.invoke('items:restore', id),
  deleteItemForever: (id) => ipcRenderer.invoke('items:deleteForever', id),
  emptyTrash: () => ipcRenderer.invoke('items:emptyTrash'),
  reorderItems: (orderedIds) => ipcRenderer.invoke('items:reorder', orderedIds),
  updateItem: (id, patch) => ipcRenderer.invoke('items:update', id, patch),
  touchItem: (id) => ipcRenderer.invoke('items:touch', id),
  setItemThumbnail: (id, bytes, width, height) =>
    ipcRenderer.invoke('items:setThumbnail', id, bytes, width, height),
  cropItem: (id, region) => ipcRenderer.invoke('items:crop', id, region),
  readText: (id) => ipcRenderer.invoke('items:readText', id),
  writeText: (id, content) => ipcRenderer.invoke('items:writeText', id, content),
  revealItem: (id) => ipcRenderer.invoke('items:reveal', id),
  exportItem: (id, filename) => ipcRenderer.invoke('items:export', id, filename),
  exportItems: (ids, title) => ipcRenderer.invoke('items:exportMany', ids, title),
  listFolders: () => ipcRenderer.invoke('folders:list'),
  createFolder: (name) => ipcRenderer.invoke('folders:create', name),
  renameFolder: (id, name) => ipcRenderer.invoke('folders:rename', id, name),
  deleteFolder: (id) => ipcRenderer.invoke('folders:delete', id),
  listSmartFolders: () => ipcRenderer.invoke('smart:list'),
  createSmartFolder: (name, filters) => ipcRenderer.invoke('smart:create', name, filters),
  deleteSmartFolder: (id) => ipcRenderer.invoke('smart:delete', id),
  listTags: () => ipcRenderer.invoke('tags:list'),
  createTag: (name) => ipcRenderer.invoke('tags:create', name),
  deleteTag: (name) => ipcRenderer.invoke('tags:delete', name),
  getPrefs: () => ipcRenderer.invoke('prefs:get'),
  setPrefs: (patch) => ipcRenderer.invoke('prefs:set', patch),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  openItemExternally: (id) => ipcRenderer.invoke('items:openExternal', id),
  findSimilar: (maxDistance) => ipcRenderer.invoke('items:findSimilar', maxDistance),
  importEagle: () => ipcRenderer.invoke('eagle:import'),
  listWatched: () => ipcRenderer.invoke('watch:list'),
  addWatched: () => ipcRenderer.invoke('watch:add'),
  removeWatched: (dir) => ipcRenderer.invoke('watch:remove', dir),
  onEagleProgress: (cb) => subscribe('eagle:progress', cb),
  onItemsChanged: (cb) => subscribe('items:changed', cb),
  onItemsAdded: (cb) => subscribe('items:added', cb)
}

/** Listen on a main → renderer channel; returns a function that stops listening. */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_e: Electron.IpcRendererEvent, payload: T): void => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('rak', api)
