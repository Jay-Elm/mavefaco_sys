// Browser-side image handling for the ID capture flow: crop, resize to a
// sensible upload size, re-encode as JPEG (which also drops EXIF data such
// as GPS location), and measure quality on a small copy.
import { assessPhoto, type PhotoProblem } from '@/lib/photoQuality'

export interface CapturedPhoto {
  blob: Blob
  url: string
  problems: PhotoProblem[]
  source: 'camera' | 'upload'
}

type Crop = { x: number; y: number; w: number; h: number }

/** Longest side of a photo sent for review, in pixels: plenty to read an ID, small enough for three to fit one request. */
const MAX_SIDE = 1600
/** Width of the copy the quality checks run on. */
const CHECK_WIDTH = 640

export async function preparePhoto(
  source: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  crop: Crop | null,
  from: CapturedPhoto['source'],
): Promise<CapturedPhoto> {
  const c = crop ?? { x: 0, y: 0, w: sourceW, h: sourceH }
  const scale = Math.min(1, MAX_SIDE / Math.max(c.w, c.h))
  const out = document.createElement('canvas')
  out.width = Math.round(c.w * scale)
  out.height = Math.round(c.h * scale)
  out.getContext('2d')!.drawImage(source, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height)

  const check = document.createElement('canvas')
  check.width = Math.min(CHECK_WIDTH, out.width)
  check.height = Math.round(out.height * (check.width / out.width))
  const ctx = check.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(out, 0, 0, check.width, check.height)
  const { problems } = assessPhoto(ctx.getImageData(0, 0, check.width, check.height))

  const blob = await new Promise<Blob>((resolve, reject) =>
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the photo'))), 'image/jpeg', 0.85),
  )
  return { blob, url: URL.createObjectURL(blob), problems, source: from }
}

/** A photo chosen from the device (no camera available), turned upright per its EXIF orientation. */
export async function prepareUpload(file: File): Promise<CapturedPhoto> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    return await preparePhoto(bitmap, bitmap.width, bitmap.height, null, 'upload')
  } finally {
    bitmap.close()
  }
}
