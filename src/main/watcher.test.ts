import { promises as fs } from 'fs'
import os from 'os'
import { join } from 'path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Item } from './library'

const sent: { channel: string; payload: unknown }[] = []
vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: () => [
      { webContents: { send: (channel: string, payload: unknown) => sent.push({ channel, payload }) } }
    ]
  }
}))

const L = await import('./library')
const W = await import('./watcher')

let root: string

async function until(check: () => boolean, ms = 4000): Promise<void> {
  const end = Date.now() + ms
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out')
    await new Promise((r) => setTimeout(r, 50))
  }
}

beforeEach(async () => {
  root = await fs.mkdtemp(join(os.tmpdir(), 'dyskfiles-watch-'))
  sent.length = 0
})

afterEach(async () => {
  W.stopWatchers()
  L.setCurrentPath(null)
  await fs.rm(root, { recursive: true, force: true })
})

describe('watching opened items', () => {
  it('reports a save made by another app, including a save-by-rename', async () => {
    await fs.mkdir(join(root, 'src'))
    await fs.writeFile(join(root, 'src', 'note.md'), 'one')
    const lib = await L.createLibrary(root, 'Test')
    await W.syncWatchers()
    const [item] = await L.importPaths([join(root, 'src')])
    const file = join(lib.path, item.original)
    await W.watchItem(item.id, file)

    await fs.writeFile(file, 'two!')
    await until(() => sent.some((s) => s.channel === 'items:changed'))
    expect((sent.at(-1)!.payload as Item).size).toBe(4)

    // Editors often write a temp file and rename it over the original.
    sent.length = 0
    await fs.writeFile(`${file}.swap`, 'three!!')
    await fs.rename(`${file}.swap`, file)
    await until(() => sent.some((s) => s.channel === 'items:changed'))
    expect((sent.at(-1)!.payload as Item).size).toBe(7)
  })

  it('ignores events that do not change the file', async () => {
    await fs.mkdir(join(root, 'src'))
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f00' } })
      .png()
      .toFile(join(root, 'src', 'a.png'))
    const lib = await L.createLibrary(root, 'Test')
    await W.syncWatchers()
    const [item] = await L.importPaths([join(root, 'src')])
    const file = join(lib.path, item.original)
    await W.watchItem(item.id, file)

    // A sibling file changing in the same folder must not refresh this item.
    await fs.writeFile(join(lib.path, item.thumbnail), await fs.readFile(join(lib.path, item.thumbnail)))
    await fs.chmod(file, 0o644)
    await new Promise((r) => setTimeout(r, 900))
    expect(sent.filter((s) => s.channel === 'items:changed')).toEqual([])
  })
})

describe('watched folders', () => {
  it('auto-imports new files, and catches up on files added while closed', async () => {
    const inbox = join(root, 'inbox')
    await fs.mkdir(inbox)
    const lib = await L.createLibrary(root, 'Test')
    await L.addWatched(inbox)
    await W.syncWatchers()

    await fs.writeFile(join(inbox, 'live.txt'), 'hello')
    // The file must settle (1.5s) before it is imported.
    await until(() => sent.some((s) => s.channel === 'items:added'), 8000)
    expect((sent.at(-1)!.payload as Item[]).map((i) => i.name)).toEqual(['live'])

    // Close the library, drop a file, reopen: it is imported on open.
    W.stopWatchers()
    L.setCurrentPath(null)
    await fs.writeFile(join(inbox, 'offline.txt'), 'while closed')
    await new Promise((r) => setTimeout(r, 1600))
    sent.length = 0
    await L.openLibrary(lib.path)
    await W.syncWatchers()
    await until(() => sent.some((s) => s.channel === 'items:added'), 8000)
    expect((sent.at(-1)!.payload as Item[]).map((i) => i.name)).toEqual(['offline'])
    expect((await L.listItems()).map((i) => i.name).sort()).toEqual(['live', 'offline'])
  }, 20000)
})
