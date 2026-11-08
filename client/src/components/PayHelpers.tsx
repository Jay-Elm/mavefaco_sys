'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Check, Copy, Download, Loader2, X, ZoomIn } from 'lucide-react'

/** A small button that copies `value` and says so for two seconds. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked (old browser, no permission): the value is on screen to copy by hand.
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-soil hover:border-paddy"
    >
      {copied ? <Check size={12} className="text-paddy" /> : <Copy size={12} />}
      {copied ? 'Copied' : label}
    </button>
  )
}

/**
 * Saves an image to the device. A phone can't scan its own screen, but the
 * GCash app reads a QR code from the gallery (Scan QR → Upload QR).
 * Falls back to opening the image, where it can be long-pressed and saved.
 */
export async function saveImage(url: string, filename: string) {
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(String(res.status))
    const blob = await res.blob()
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(href), 10_000)
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/** A QR code that opens full screen when tapped, with a Save button. */
export function QrViewer({ url, alt, filename, size = 160 }: { url: string; alt: string; filename: string; size?: number }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  async function save() {
    setSaving(true)
    await saveImage(url, filename)
    setSaving(false)
  }

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`${alt}: open full screen`}
        className="group relative rounded-md border border-gray-200 bg-white overflow-hidden"
        style={{ width: size, height: size }}
      >
        <Image src={url} alt={alt} fill unoptimized className="object-contain" />
        <span className="absolute bottom-1 right-1 rounded bg-white/90 p-0.5 text-gray-600 group-hover:text-soil"><ZoomIn size={14} /></span>
      </button>
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-1 text-xs font-medium text-paddy hover:underline disabled:opacity-60"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Save QR image
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-4 bg-black/85 p-4"
          onClick={() => setOpen(false)}
        >
          <div className="relative w-full max-w-md aspect-square bg-white rounded-lg" onClick={(e) => e.stopPropagation()}>
            <Image src={url} alt={alt} fill unoptimized className="object-contain p-2" />
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-soil disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Save QR image
            </button>
            <button type="button" onClick={() => setOpen(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white">
              <X size={14} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
