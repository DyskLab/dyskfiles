import sharp from 'sharp'

export interface ImageMeta {
  width: number
  height: number
  color: string | null // dominant color as #rrggbb
  colors: string[] // palette of ~5 representative colors
}

const THUMB_WIDTH = 400

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
}

/**
 * Generate a WebP thumbnail (max width 400px, never upscaled) and return the
 * original image's intrinsic dimensions + dominant color.
 */
export async function makeThumbnail(inputPath: string, outputPath: string): Promise<ImageMeta> {
  const pipeline = sharp(inputPath, { failOn: 'none' })
  const meta = await pipeline.metadata()

  // `.rotate()` bakes in EXIF orientation so thumbnails aren't sideways.
  await pipeline
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outputPath)

  // After auto-rotation the reported width/height may swap; account for EXIF.
  const rotated = meta.orientation && meta.orientation >= 5
  const width = rotated ? meta.height ?? 0 : meta.width ?? 0
  const height = rotated ? meta.width ?? 0 : meta.height ?? 0

  let color: string | null = null
  try {
    const { dominant } = await sharp(inputPath, { failOn: 'none' }).stats()
    color = `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`
  } catch {
    color = null
  }

  // Palette: sample up to 10 columns across the image, then de-duplicate near-identical ones.
  const colors: string[] = []
  try {
    const N = 10
    const { data, info } = await sharp(inputPath, { failOn: 'none' })
      .flatten({ background: '#000000' })
      .resize(N, 1, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const ch = info.channels
    const seen: [number, number, number][] = []
    for (let i = 0; i < N; i++) {
      const o = i * ch
      const r = data[o]
      const g = data[o + 1]
      const b = data[o + 2]
      // skip if very close to an already-collected colour
      if (seen.some((c) => Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b) < 24)) continue
      seen.push([r, g, b])
      colors.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`)
    }
  } catch {
    // leave palette empty
  }

  return { width, height, color, colors }
}

/**
 * Build a WebP thumbnail from an in-memory frame buffer (e.g. a video poster
 * captured in the renderer). Returns the frame's dominant colour + palette.
 * The intrinsic width/height are taken from the buffer itself.
 */
export async function makeThumbnailFromBuffer(
  buf: Buffer,
  outputPath: string
): Promise<ImageMeta> {
  const meta = await sharp(buf, { failOn: 'none' }).metadata()
  await sharp(buf, { failOn: 'none' })
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toFile(outputPath)

  let color: string | null = null
  try {
    const { dominant } = await sharp(buf, { failOn: 'none' }).stats()
    color = `#${toHex(dominant.r)}${toHex(dominant.g)}${toHex(dominant.b)}`
  } catch {
    color = null
  }

  const colors: string[] = []
  try {
    const N = 10
    const { data, info } = await sharp(buf, { failOn: 'none' })
      .flatten({ background: '#000000' })
      .resize(N, 1, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true })
    const ch = info.channels
    const seen: [number, number, number][] = []
    for (let i = 0; i < N; i++) {
      const o = i * ch
      const r = data[o]
      const g = data[o + 1]
      const b = data[o + 2]
      if (seen.some((c) => Math.abs(c[0] - r) + Math.abs(c[1] - g) + Math.abs(c[2] - b) < 24)) continue
      seen.push([r, g, b])
      colors.push(`#${toHex(r)}${toHex(g)}${toHex(b)}`)
    }
  } catch {
    // leave palette empty
  }

  return { width: meta.width ?? 0, height: meta.height ?? 0, color, colors }
}
