'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { preparePhoto, type CapturedPhoto } from './imageTools'

export type CameraUnavailable = 'no-camera' | 'denied'

interface Props {
  // 'environment' is the rear camera (the ID itself), 'user' the front one (the selfie).
  facing: 'environment' | 'user'
  // Width ÷ height of the ID frame drawn on screen; the photo is cropped to it.
  // Omitted for the selfie, which keeps the whole picture.
  frameAspect?: number
  prompt: string
  onCapture: (photo: CapturedPhoto) => void
  onUnavailable: (why: CameraUnavailable) => void
}

/** Share of the picture the ID frame fills along its tighter side. */
const FRAME_FILL = 0.86
/** Extra margin kept around the frame when cropping, so the card's edges aren't cut. */
const CROP_MARGIN = 0.04

/** The ID frame as fractions of the picture: centred, as large as fits. */
function frameBox(pictureAspect: number, frameAspect: number) {
  let w = FRAME_FILL
  let h = (w * pictureAspect) / frameAspect
  if (h > FRAME_FILL) {
    h = FRAME_FILL
    w = (h * frameAspect) / pictureAspect
  }
  return { w, h, x: (1 - w) / 2, y: (1 - h) / 2 }
}

/** A live camera view with an ID-shaped frame (or a selfie guide) and a shutter button. */
export default function IdCamera({ facing, frameAspect, prompt, onCapture, onUnavailable }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [capturing, setCapturing] = useState(false)

  useEffect(() => {
    let stream: MediaStream | null = null
    let cancelled = false
    if (!navigator.mediaDevices?.getUserMedia) {
      onUnavailable('no-camera')
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return }
        stream = s
        const video = videoRef.current
        if (!video) return
        video.srcObject = s
        video.onloadedmetadata = () => {
          setSize({ w: video.videoWidth, h: video.videoHeight })
          video.play().catch(() => {})
        }
      })
      .catch((err: DOMException) => {
        if (!cancelled) onUnavailable(err?.name === 'NotAllowedError' ? 'denied' : 'no-camera')
      })
    return () => {
      cancelled = true
      stream?.getTracks().forEach((t) => t.stop())
    }
    // Restart only when switching cameras; the callbacks don't change the stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  const box = size && frameAspect ? frameBox(size.w / size.h, frameAspect) : null

  async function capture() {
    const video = videoRef.current
    if (!video || !size || capturing) return
    setCapturing(true)
    try {
      let crop = null
      if (box) {
        const mx = CROP_MARGIN * box.w, my = CROP_MARGIN * box.h
        const x0 = Math.max(0, box.x - mx), y0 = Math.max(0, box.y - my)
        const x1 = Math.min(1, box.x + box.w + mx), y1 = Math.min(1, box.y + box.h + my)
        crop = { x: x0 * size.w, y: y0 * size.h, w: (x1 - x0) * size.w, h: (y1 - y0) * size.h }
      }
      onCapture(await preparePhoto(video, size.w, size.h, crop, 'camera'))
    } finally {
      setCapturing(false)
    }
  }

  return (
    <div>
      <p className="text-center text-sm font-medium text-gray-800 mb-2">{prompt}</p>
      <div
        className="relative w-full max-w-xl mx-auto overflow-hidden rounded-xl bg-black"
        style={{ aspectRatio: size ? `${size.w} / ${size.h}` : '4 / 3' }}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-contain ${facing === 'user' ? '-scale-x-100' : ''}`}
        />
        {!size && (
          <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm gap-2">
            <Loader2 size={18} className="animate-spin" /> Starting camera…
          </div>
        )}
        {box && (
          <div
            className="absolute rounded-lg border-2 border-white/90 pointer-events-none"
            style={{
              left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%`,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
            }}
          />
        )}
        {size && !frameAspect && (
          // Selfie guide: the face on one side, the ID held up beside it.
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute left-[14%] top-[14%] w-[34%] h-[66%] rounded-[50%] border-2 border-white/90" />
            <div className="absolute right-[10%] top-[40%] w-[34%] aspect-[85.6/54] rounded-md border-2 border-dashed border-white/90" />
          </div>
        )}
      </div>
      <div className="flex justify-center mt-4">
        <button
          type="button"
          onClick={capture}
          disabled={!size || capturing}
          aria-label="Take photo"
          className="w-16 h-16 rounded-full bg-paddy text-white flex items-center justify-center shadow-lg ring-4 ring-paddy/20 hover:bg-paddy-deep disabled:opacity-50"
        >
          {capturing ? <Loader2 size={22} className="animate-spin" /> : <Camera size={24} />}
        </button>
      </div>
    </div>
  )
}
