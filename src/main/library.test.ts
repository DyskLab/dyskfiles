import { promises as fs } from 'fs'
import os from 'os'
import { join } from 'path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as L from './library'

let root: string
let src: string

async function png(name: string, width = 64, height = 32, background = '#f00'): Promise<string> {
  const p = join(src, name)
  await sharp({ create: { width, height, channels: 3, background } }).png().toFile(p)
  return p
}

async function text(name: string, content: string): Promise<string> {
  const p = join(src, name)
  await fs.writeFile(p, content)
  return p
}

/** Read an item's metadata straight from disk, bypassing the cache. */
async function onDisk(libPath: string, id: string): Promise<L.Item> {
  const bucket = id.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 3)
  return JSON.parse(await fs.readFile(join(libPath, bucket, `${id}.json`), 'utf-8'))
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

beforeEach(async () => {
  root = await fs.mkdtemp(join(os.tmpdir(), 'dyskfiles-test-'))
  src = join(root, 'src')
  await fs.mkdir(src)
})

afterEach(async () => {
  L.setCurrentPath(null)
  await fs.rm(root, { recursive: true, force: true })
})

describe('import and list', () => {
  it('imports images and text, with thumbnails and dimensions', async () => {
    await png('red.png', 64, 32)
    await text('notes.md', '# hi')
    const lib = await L.createLibrary(root, 'Test')
    const imported = await L.importPaths([src])
    expect(imported).toHaveLength(2)

    const items = await L.listItems()
    const img = items.find((i) => i.kind === 'image')!
    const txt = items.find((i) => i.kind === 'text')!
    expect(img).toMatchObject({ width: 64, height: 32, linked: false })
    expect(img.thumbnail).toMatch(/\.webp$/)
    await expect(fs.access(join(lib.path, img.thumbnail))).resolves.toBeUndefined()
    expect(txt.thumbnail).toBe('')

    const meta = JSON.parse(await fs.readFile(join(lib.path, 'library.json'), 'utf-8'))
    expect(meta.itemCount).toBe(2)
  })

  it('hands out copies, so mutating a result never changes the library', async () => {
    await png('a.png')
    await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    const [first] = await L.listItems()
    first.name = 'HACKED'
    first.tags.push('leak')
    const [again] = await L.listItems()
    expect(again.name).not.toBe('HACKED')
    expect(again.tags).toEqual([])
  })

  it('puts newly imported items first in manual order', async () => {
    await png('old.png')
    await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    await fs.rm(join(src, 'old.png'))
    await png('new.png')
    await L.importPaths([src])
    expect((await L.listItems()).map((i) => i.name)).toEqual(['new', 'old'])
  })
})

describe('editing', () => {
  it('writes updates to disk and to the cache', async () => {
    await png('a.png')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    const updated = await L.updateItem(item.id, { tags: ['x'], rating: 4, note: 'n' })
    expect(updated).toMatchObject({ tags: ['x'], rating: 4, note: 'n' })
    expect(await onDisk(lib.path, item.id)).toMatchObject({ tags: ['x'], rating: 4, note: 'n' })
    expect((await L.listItems())[0]).toMatchObject({ tags: ['x'], rating: 4 })
  })

  it('returns null for an unknown id', async () => {
    await L.createLibrary(root, 'Test')
    expect(await L.updateItem('nope', { rating: 1 })).toBeNull()
    expect(await L.touchItem('nope')).toBeNull()
    expect(await L.readText('nope')).toBeNull()
  })

  it('reorders items', async () => {
    await png('a.png')
    await png('b.png')
    await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    const ids = (await L.listItems()).map((i) => i.id).reverse()
    await L.reorderItems(ids)
    expect((await L.listItems()).map((i) => i.id)).toEqual(ids)
  })

  it('strips a deleted tag and a deleted folder from every item', async () => {
    await png('a.png')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    const folder = await L.createFolder('F')
    await L.createTag('t')
    await L.updateItem(item.id, { tags: ['t', 'keep'], folderIds: [folder.id] })

    await L.deleteTag('t')
    await L.deleteFolder(folder.id)
    expect(await onDisk(lib.path, item.id)).toMatchObject({ tags: ['keep'], folderIds: [] })
    expect(await L.listTags()).toEqual([])
    expect(await L.listFolders()).toEqual([])
  })

  it('reads and writes text documents, updating the size', async () => {
    await text('n.md', '# hi')
    await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    expect(await L.readText(item.id)).toBe('# hi')
    const saved = await L.writeText(item.id, 'changed!')
    expect(saved?.size).toBe(8)
    expect(await L.readText(item.id)).toBe('changed!')
  })
})

describe('trash and deletion', () => {
  it('moves items to the trash and back, keeping the count right', async () => {
    await png('a.png')
    await png('b.png')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    const count = async (): Promise<number> =>
      JSON.parse(await fs.readFile(join(lib.path, 'library.json'), 'utf-8')).itemCount

    await L.trashItem(item.id)
    expect(await L.listItems()).toHaveLength(1)
    expect(await L.listTrash()).toHaveLength(1)
    expect(await count()).toBe(1)

    await L.restoreItem(item.id)
    expect(await L.listItems()).toHaveLength(2)
    expect(await count()).toBe(2)
  })

  it('deletes forever, removing the metadata, original and thumbnail', async () => {
    await png('a.png')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    await L.deleteItemForever(item.id)
    expect(await L.listItems()).toEqual([])
    expect(await walk(lib.path)).toEqual(
      expect.not.arrayContaining([expect.stringContaining(item.id)])
    )
  })

  it('empties the trash', async () => {
    await png('a.png')
    await png('b.png')
    await L.createLibrary(root, 'Test')
    const items = await L.importPaths([src])
    for (const it of items) await L.trashItem(it.id)
    expect(await L.emptyTrash()).toBe(2)
    expect(await L.listTrash()).toEqual([])
  })
})

describe('linked imports', () => {
  it('references the file in place and never deletes it', async () => {
    const file = await png('linked.png')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([file], null, true)
    expect(item).toMatchObject({ linked: true, original: file })
    expect((await walk(lib.path)).some((p) => p.endsWith('.png'))).toBe(false)
    expect(await L.resolveAsset('original', item.id)).toBe(file)

    await L.deleteItemForever(item.id)
    await expect(fs.access(file)).resolves.toBeUndefined()
  })
})

describe('cache consistency', () => {
  it('picks up edits made outside the app when the library is reopened', async () => {
    await png('a.png')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    const raw = await onDisk(lib.path, item.id)
    raw.note = 'from finder'
    const bucket = item.thumbnail.split(/[\\/]/)[0]
    await fs.writeFile(join(lib.path, bucket, `${item.id}.json`), JSON.stringify(raw))

    await L.openLibrary(lib.path)
    expect((await L.listItems())[0].note).toBe('from finder')
  })

  it('skips corrupt metadata files instead of failing', async () => {
    await png('a.png')
    const lib = await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    await fs.mkdir(join(lib.path, 'zzz'))
    await fs.writeFile(join(lib.path, 'zzz', 'broken.json'), '{ not json')
    await L.openLibrary(lib.path)
    expect(await L.listItems()).toHaveLength(1)
  })

  it('never leaves temp files behind', async () => {
    await png('a.png')
    await png('b.png')
    const lib = await L.createLibrary(root, 'Test')
    const items = await L.importPaths([src])
    await Promise.all(items.map((it, i) => L.updateItem(it.id, { rating: i + 1 })))
    await L.reorderItems(items.map((i) => i.id))
    expect((await walk(lib.path)).filter((p) => p.endsWith('.tmp'))).toEqual([])
  })
})

describe('asset resolution', () => {
  it('resolves thumbnails and rejects path traversal', async () => {
    await png('a.png')
    await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    expect(await L.resolveAsset('thumb', item.id)).toMatch(/\.webp$/)
    expect(await L.resolveAsset('thumb', '../../etc/passwd')).toBeNull()
    expect(await L.resolveAsset('thumb', 'missing-id')).toBeNull()
  })
})

describe('merging libraries', () => {
  it('copies every item into the target, renaming clashing ids', async () => {
    await png('a.png')
    await png('b.png')
    const source = await L.createLibrary(root, 'Source')
    await L.importPaths([src])
    const target = await L.createLibrary(root, 'Target')

    expect(await L.mergeInto(source.path, target.path)).toBe(2)
    // Merging again must not overwrite the first copies.
    expect(await L.mergeInto(source.path, target.path)).toBe(2)
    const merged = await L.listItems()
    expect(merged).toHaveLength(4)
    expect(new Set(merged.map((i) => i.id)).size).toBe(4)
    for (const it of merged) {
      expect(await L.resolveAsset('original', it.id)).not.toBeNull()
    }
  })
})

describe('legacy layout', () => {
  it('migrates items/ originals/ thumbnails/ into bucket folders', async () => {
    const lib = await L.createLibrary(root, 'Old')
    await fs.mkdir(join(lib.path, 'items'))
    await fs.mkdir(join(lib.path, 'originals'))
    await fs.mkdir(join(lib.path, 'thumbnails'))
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#0f0' } })
      .png()
      .toFile(join(lib.path, 'originals', 'pic-1.png'))
    await fs.writeFile(join(lib.path, 'thumbnails', 'pic-1.webp'), 'thumb')
    const legacy = {
      id: 'pic-1',
      name: 'pic',
      ext: 'png',
      kind: 'image',
      importedAt: new Date().toISOString(),
      original: join('originals', 'pic-1.png'),
      thumbnail: join('thumbnails', 'pic-1.webp'),
      tags: [],
      folderId: 'f1',
      deletedAt: null
    }
    await fs.writeFile(join(lib.path, 'items', 'pic-1.json'), JSON.stringify(legacy))

    await L.openLibrary(lib.path)
    const [item] = await L.listItems()
    expect(item).toMatchObject({
      id: 'pic-1',
      original: join('pic', 'pic-1.png'),
      thumbnail: join('pic', 'pic-1.webp'),
      folderIds: ['f1'],
      linked: false
    })
    await expect(fs.access(join(lib.path, 'pic', 'pic-1.png'))).resolves.toBeUndefined()
    for (const dir of ['items', 'originals', 'thumbnails']) {
      await expect(fs.access(join(lib.path, dir))).rejects.toThrow()
    }
  })
})

describe('new kinds', () => {
  it('imports PDFs and fonts with the right kind and no thumbnail yet', async () => {
    await text('doc.pdf', '%PDF-1.4 fake')
    await text('face.woff2', 'wOF2 fake')
    await L.createLibrary(root, 'Test')
    const items = await L.importPaths([src])
    expect(items.map((i) => i.kind).sort()).toEqual(['font', 'pdf'])
    expect(items.every((i) => i.thumbnail === '')).toBe(true)
  })
})

describe('external edits', () => {
  it('refreshes an image after its file changes, and ignores unchanged files', async () => {
    await png('a.png', 40, 20)
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    const stamp = (await L.fileStamp(item.id))!
    expect(await L.refreshItemFromDisk(item.id, stamp)).toBeNull() // nothing changed

    const original = join(lib.path, item.original)
    await sharp({ create: { width: 30, height: 90, channels: 3, background: '#00f' } })
      .png()
      .toFile(`${original}.new`)
    await fs.rename(`${original}.new`, original)
    const refreshed = await L.refreshItemFromDisk(item.id, stamp)
    expect(refreshed).toMatchObject({ width: 30, height: 90 })
    expect(refreshed!.colors.length).toBeGreaterThan(0)
    expect(await onDisk(lib.path, item.id)).toMatchObject({ width: 30, height: 90 })
  })

  it('clears a rendered thumbnail so the renderer draws a new one', async () => {
    await text('doc.pdf', '%PDF-1.4 v1')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    await L.setItemThumbnail(item.id, new Uint8Array(await sharp({ create: { width: 4, height: 4, channels: 3, background: '#fff' } }).png().toBuffer()), 10, 10)
    const stamp = (await L.fileStamp(item.id))!
    await fs.writeFile(join(lib.path, item.original), '%PDF-1.4 version two')
    const refreshed = await L.refreshItemFromDisk(item.id, stamp)
    expect(refreshed?.thumbnail).toBe('')
  })
})

describe('duplicates', () => {
  it('finds byte-identical files, including linked ones', async () => {
    const a = await png('a.png', 20, 20, '#123456')
    await fs.copyFile(a, join(src, 'a-copy.png'))
    await png('other.png', 20, 20, '#654321')
    const outside = join(root, 'outside')
    await fs.mkdir(outside)
    await fs.copyFile(a, join(outside, 'linked.png'))

    await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    await L.importPaths([join(outside, 'linked.png')], null, true)
    const groups = await L.findDuplicates()
    expect(groups).toHaveLength(1)
    expect(groups[0].map((i) => i.name).sort()).toEqual(['a', 'a-copy', 'linked'])
  })

  it('groups resized copies of a picture as similar, but not different pictures', async () => {
    const pattern = (w: number, h: number): Promise<Buffer> =>
      sharp({
        create: { width: w, height: h, channels: 3, background: '#fff' }
      })
        .composite([
          {
            input: Buffer.from(
              `<svg width="${w}" height="${h}"><rect x="0" y="0" width="${w / 2}" height="${h}" fill="#000"/><circle cx="${w * 0.75}" cy="${h / 2}" r="${h / 4}" fill="#888"/></svg>`
            )
          }
        ])
        .png()
        .toBuffer()
    await fs.writeFile(join(src, 'big.png'), await pattern(400, 300))
    await fs.writeFile(join(src, 'small.png'), await pattern(200, 150))
    await sharp({ create: { width: 300, height: 300, channels: 3, background: '#fff' } })
      .composite([{ input: Buffer.from('<svg width="300" height="300"><rect x="0" y="200" width="300" height="100" fill="#000"/></svg>') }])
      .png()
      .toFile(join(src, 'different.png'))

    const lib = await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    const groups = await L.findSimilar()
    expect(groups).toHaveLength(1)
    expect(groups[0].map((i) => i.name)).toEqual(['big', 'small']) // largest first
    // Hashes are stored, so the next run does not recompute them.
    const stored = await L.listItems()
    expect(stored.every((i) => typeof i.dhash === 'string' && i.dhash.length === 32)).toBe(true)
    expect((await onDisk(lib.path, stored[0].id)).dhash).toBe(stored[0].dhash)
  })
})

describe('similar: pictures that must stay apart', () => {
  it('does not group flat pictures of different colors', async () => {
    for (const [name, color] of [['red', '#e11d48'], ['green', '#16a34a'], ['purple', '#7c3aed']]) {
      await png(`${name}.png`, 120, 90, color)
    }
    await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    expect(await L.findSimilar()).toEqual([])
  })

  it('does not group pictures that differ only from top to bottom', async () => {
    const band = (y: number): Buffer =>
      Buffer.from(`<svg width="200" height="200"><rect width="200" height="200" fill="#111"/><rect x="0" y="${y}" width="200" height="60" fill="#22c55e"/></svg>`)
    await sharp(band(0)).png().toFile(join(src, 'top.png'))
    await sharp(band(140)).png().toFile(join(src, 'bottom.png'))
    await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    expect(await L.findSimilar()).toEqual([])
  })

  it('recomputes hashes stored in the old 64-bit format', async () => {
    await png('a.png', 50, 50, '#123456')
    const lib = await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([src])
    const raw = await onDisk(lib.path, item.id)
    raw.dhash = '0000000000000000'
    await fs.writeFile(join(lib.path, item.thumbnail.split(/[\\/]/)[0], `${item.id}.json`), JSON.stringify(raw))
    await L.openLibrary(lib.path)
    await L.findSimilar()
    expect((await onDisk(lib.path, item.id)).dhash).toHaveLength(32)
  })
})

describe('Eagle import', () => {
  async function makeEagle(): Promise<string> {
    const eagle = join(root, 'My.library')
    await fs.mkdir(join(eagle, 'images'), { recursive: true })
    await fs.writeFile(
      join(eagle, 'metadata.json'),
      JSON.stringify({
        applicationVersion: '4.0',
        folders: [{ id: 'F1', name: 'Design', children: [{ id: 'F2', name: 'Logos', children: [] }] }]
      })
    )
    const item = async (id: string, meta: Record<string, unknown>, file?: string): Promise<void> => {
      const dir = join(eagle, 'images', `${id}.info`)
      await fs.mkdir(dir)
      await fs.writeFile(join(dir, 'metadata.json'), JSON.stringify({ id, ...meta }))
      if (file) {
        const name = `${meta.name}.${meta.ext}`
        if (meta.ext === 'png') {
          await sharp({ create: { width: 12, height: 8, channels: 3, background: '#0a0' } }).png().toFile(join(dir, name))
        } else await fs.writeFile(join(dir, name), file)
        await fs.writeFile(join(dir, `${meta.name}_thumbnail.png`), 'not the original')
      }
    }
    await item('E1', { name: 'logo', ext: 'png', tags: ['brand', 'blue'], folders: ['F2'], star: 4, annotation: 'final', url: 'https://example.com' }, 'x')
    await item('E2', { name: 'notes', ext: 'txt', tags: [], folders: ['F1'], isDeleted: true }, 'hello')
    await item('E3', { name: 'mock', ext: 'psd', tags: [], folders: [] }, 'psd bytes')
    await item('E4', { name: 'gone', ext: 'png', tags: [], folders: [] }) // file missing
    return eagle
  }

  it('surveys without importing', async () => {
    const eagle = await makeEagle()
    await L.createLibrary(root, 'Test')
    expect(await L.surveyEagle(eagle)).toMatchObject({ name: 'My', items: 4, supported: 3, folders: 2 })
    expect(await L.listItems()).toEqual([])
  })

  it('imports items with tags, folders, rating, note, URL and trash state', async () => {
    const eagle = await makeEagle()
    await L.createLibrary(root, 'Test')
    const result = await L.importEagle(eagle)
    expect(result).toMatchObject({ unsupported: 1, missing: 1, already: 0, folders: 2 })
    expect(result.imported).toHaveLength(2)

    const folders = await L.listFolders()
    expect(folders.map((f) => f.name).sort()).toEqual(['Design', 'Design / Logos'])
    const logos = folders.find((f) => f.name === 'Design / Logos')!

    const [logo] = await L.listItems()
    expect(logo).toMatchObject({
      name: 'logo',
      kind: 'image',
      width: 12,
      height: 8,
      tags: ['brand', 'blue'],
      folderIds: [logos.id],
      rating: 4,
      note: 'final',
      url: 'https://example.com',
      eagleId: 'E1'
    })
    const [notes] = await L.listTrash()
    expect(notes).toMatchObject({ name: 'notes', eagleId: 'E2' })
    expect(await L.readText(notes.id)).toBe('hello')
    expect((await L.listTags()).sort()).toEqual(['blue', 'brand'])

    // The Eagle library is untouched.
    await expect(fs.readFile(join(eagle, 'images', 'E1.info', 'logo_thumbnail.png'), 'utf-8')).resolves.toBe('not the original')
  })

  it('does not import anything twice', async () => {
    const eagle = await makeEagle()
    await L.createLibrary(root, 'Test')
    await L.importEagle(eagle)
    const again = await L.importEagle(eagle)
    expect(again).toMatchObject({ already: 2, folders: 0 })
    expect(again.imported).toHaveLength(0)
    expect(await L.listFolders()).toHaveLength(2)
  })

  it('rejects a folder that is not an Eagle library', async () => {
    await L.createLibrary(root, 'Test')
    await expect(L.surveyEagle(src)).rejects.toThrow(/Not an Eagle library/)
  })
})

describe('watched folders', () => {
  it('imports only files that arrive after the folder was added, once', async () => {
    const inbox = join(root, 'inbox')
    await fs.mkdir(inbox)
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#f0f' } }).png().toFile(join(inbox, 'old.png'))
    await L.createLibrary(root, 'Test')
    expect(await L.addWatched(inbox)).toEqual([inbox])

    expect((await L.importFromWatched(0)).imported).toEqual([])
    await sharp({ create: { width: 8, height: 8, channels: 3, background: '#0ff' } }).png().toFile(join(inbox, 'new.png'))
    await fs.mkdir(join(inbox, 'sub'))
    await fs.writeFile(join(inbox, 'sub', 'deep.md'), '# deep')

    const first = await L.importFromWatched(0)
    expect(first.imported.map((i) => i.name).sort()).toEqual(['deep', 'new'])
    expect((await L.importFromWatched(0)).imported).toEqual([])
    expect(await L.listItems()).toHaveLength(2)
  })

  it('waits for a file that is still being written', async () => {
    const inbox = join(root, 'inbox')
    await fs.mkdir(inbox)
    await L.createLibrary(root, 'Test')
    await L.addWatched(inbox)
    await fs.writeFile(join(inbox, 'fresh.txt'), 'still writing')
    const pass = await L.importFromWatched(60_000)
    expect(pass).toMatchObject({ imported: [], pending: 1 })
    expect((await L.importFromWatched(0)).imported).toHaveLength(1)
  })

  it('refuses folders that overlap the library, and can stop watching', async () => {
    const lib = await L.createLibrary(root, 'Test')
    await expect(L.addWatched(lib.path)).rejects.toThrow()
    await expect(L.addWatched(root)).rejects.toThrow() // contains the library
    const inbox = join(root, 'inbox')
    await fs.mkdir(inbox)
    await L.addWatched(inbox)
    expect(await L.removeWatched(inbox)).toEqual([])
    expect(await L.listWatched()).toEqual([])
  })
})

describe('library doctor', () => {
  it('reports a healthy library as clean', async () => {
    await png('a.png')
    await L.createLibrary(root, 'Test')
    await L.importPaths([src])
    const r = await L.checkLibrary()
    expect(r.items).toBe(1)
    expect(L.fixableCount(r)).toBe(0)
    expect(r.missingOriginals).toEqual([])
  })

  it('finds and repairs every fixable problem without losing files', async () => {
    await png('apple.png')
    await png('berry.png')
    await text('cherry.txt', 'hi')
    const lib = await L.createLibrary(root, 'Test')
    const folder = await L.createFolder('Keep')
    const [apple, berry, cherry] = (await L.importPaths([src])).sort((a, b) => a.name.localeCompare(b.name))
    await L.updateItem(apple.id, { tags: ['fruit'], folderIds: [folder.id, 'gone-folder'] })

    // Break things the way crashes, Finder and old versions do.
    await fs.rm(join(lib.path, apple.thumbnail))
    await fs.writeFile(join(lib.path, 'app', 'stray.png'), 'x')
    await fs.writeFile(join(lib.path, 'app', 'broken.json'), '{ nope')
    await fs.writeFile(join(lib.path, 'ber', `${berry.id}.json.tmp`), '{}')
    await fs.writeFile(join(lib.path, 'library.json.tmp'), '{}')
    await fs.writeFile(join(lib.path, 'tags.json'), '[]')
    // A valid item stored under the wrong file name.
    await fs.rename(join(lib.path, 'che', `${cherry.id}.json`), join(lib.path, 'che', 'copy.json'))
    const meta = JSON.parse(await fs.readFile(join(lib.path, 'library.json'), 'utf-8'))
    await fs.writeFile(join(lib.path, 'library.json'), JSON.stringify({ ...meta, itemCount: 99 }))

    const r = await L.checkLibrary()
    expect(r.repaired).toBe(false)
    expect(r.missingThumbnails).toBe(1)
    expect(r.orphans).toEqual(['app/stray.png'])
    expect(r.corrupt).toEqual(['app/broken.json'])
    expect(r.misplaced).toEqual(['che/copy.json'])
    expect(r.tempFiles.sort()).toEqual([`ber/${berry.id}.json.tmp`, 'library.json.tmp'])
    expect(r.danglingFolders).toBe(1)
    expect(r.unlistedTags).toEqual(['fruit'])
    expect(r.wrongCount).toBe(true)
    // Checking alone changes nothing.
    expect(await fs.readdir(join(lib.path, 'app'))).toContain('stray.png')

    await L.checkLibrary({ repair: true })
    const after = await L.checkLibrary()
    expect(L.fixableCount(after)).toBe(0)

    expect(await fs.stat(join(lib.path, apple.thumbnail))).toBeTruthy()
    expect((await onDisk(lib.path, apple.id)).folderIds).toEqual([folder.id])
    expect(await L.listTags()).toEqual(['fruit'])
    expect((await onDisk(lib.path, cherry.id)).name).toBe('cherry')
    expect((await L.listItems()).map((i) => i.name).sort()).toEqual(['apple', 'berry', 'cherry'])
    // Stray and unreadable files are kept, not deleted.
    const kept = (await walk(join(lib.path, 'lost-found'))).map((p) => p.slice(lib.path.length + 1))
    expect(kept.sort()).toEqual(['lost-found/app/broken.json', 'lost-found/app/stray.png', 'lost-found/che/copy.json'])
  })

  it('reports missing originals but leaves those items alone', async () => {
    const file = await png('far.png')
    await L.createLibrary(root, 'Test')
    const [item] = await L.importPaths([file], null, true)
    await fs.rm(file)
    const r = await L.checkLibrary({ repair: true })
    expect(r.missingOriginals).toEqual([{ id: item.id, name: 'far.png', path: file, linked: true }])
    expect((await L.listItems()).map((i) => i.id)).toEqual([item.id])
  })
})
