// Drawing thumbnails and previews for kinds the main process cannot render itself
// (PDF pages and fonts). Both read the file over asset:// into memory first, so
// nothing taints a canvas and no CSP exception is needed.

import type { PDFDocumentProxy } from 'pdfjs-dist'

export interface Thumb {
  bytes: Uint8Array
  width: number
  height: number
}

const THUMB_W = 640
const THUMB_H = 480

async function readOriginal(id: string): Promise<ArrayBuffer> {
  const res = await fetch(`asset://original/${id}`)
  if (!res.ok) throw new Error(`Cannot read ${id}`)
  return res.arrayBuffer()
}

function toWebp(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error('encode'))),
      'image/webp',
      0.85
    )
  })
}

// ---------- PDF ----------

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null

/** pdf.js, loaded on first use with its worker bundled next to the app. */
function pdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url')
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default
      return lib
    })
  }
  return pdfjsPromise
}

/** Open a PDF item. The caller must `destroy()` it when done. */
export async function openPdf(id: string): Promise<PDFDocumentProxy> {
  const lib = await pdfjs()
  const data = await readOriginal(id)
  return lib.getDocument({ data, isEvalSupported: false }).promise
}

/** Render one page of an open PDF into `canvas`, `cssWidth` pixels wide. */
export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  cssWidth: number
): Promise<void> {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const dpr = window.devicePixelRatio || 1
  const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr })
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  canvas.style.width = `${cssWidth}px`
  canvas.style.height = `${Math.round(viewport.height / dpr)}px`
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
}

/** Thumbnail of a PDF's first page; dimensions are the page size in points. */
export async function pdfThumbnail(id: string): Promise<Thumb> {
  const doc = await openPdf(id)
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: THUMB_W / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('no canvas')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
    return { bytes: await toWebp(canvas), width: Math.round(base.width), height: Math.round(base.height) }
  } finally {
    await doc.destroy()
  }
}

// ---------- fonts ----------

const loadedFonts = new Map<string, Promise<string>>()

/** Load a font item into the document; resolves with the CSS family name to use. */
export function loadFont(id: string): Promise<string> {
  let p = loadedFonts.get(id)
  if (!p) {
    p = (async () => {
      const family = `dysk-font-${id}`
      const face = new FontFace(family, await readOriginal(id))
      await face.load()
      document.fonts.add(face)
      return family
    })()
    p.catch(() => loadedFonts.delete(id))
    loadedFonts.set(id, p)
  }
  return p
}

/** Thumbnail of a font: a large "Aa" and a pangram. Width/height stay 0 (fonts have none). */
export async function fontThumbnail(id: string): Promise<Thumb> {
  const family = await loadFont(id)
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.fillStyle = '#f4f4f5'
  ctx.fillRect(0, 0, THUMB_W, THUMB_H)
  ctx.fillStyle = '#18181b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.font = `220px "${family}"`
  ctx.fillText('Aa', THUMB_W / 2, THUMB_H * 0.6)
  ctx.font = `34px "${family}"`
  ctx.fillStyle = '#52525b'
  ctx.fillText('The quick brown fox', THUMB_W / 2, THUMB_H * 0.85, THUMB_W - 60)
  return { bytes: await toWebp(canvas), width: 0, height: 0 }
}
