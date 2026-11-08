'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { CheckCircle, Loader2, QrCode, Trash2, Upload } from 'lucide-react'
import { useDialog } from '@/contexts/DialogContext'
import { fmtMobile } from '@/lib/payment'

export interface GcashDetails {
  gcashName: string | null
  gcashNumber: string | null
  gcashQrUrl: string | null
  /** A customer's own QR (private): a short-lived view link. */
  gcashQrViewUrl?: string | null
}

/**
 * The account's GCash name and number. For farmers, customers pay these
 * directly (with an optional QR code to scan); without them, GCash is
 * unavailable on the farmer's products. For customers they prefill the
 * payment form, and an optional QR helps a farmer who owes them a refund
 * (saved at once, privately: /api/users/me/gcash-qr).
 */
export default function GcashSettings({
  initial,
  token,
  forFarmer,
  onSaved,
}: {
  initial: GcashDetails
  token: string | null
  forFarmer: boolean
  onSaved?: (d: GcashDetails) => void
}) {
  const dialog = useDialog()
  const file = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(initial.gcashName ?? '')
  const [number, setNumber] = useState(initial.gcashNumber ? fmtMobile(initial.gcashNumber) : '')
  const [qrUrl, setQrUrl] = useState((forFarmer ? initial.gcashQrUrl : initial.gcashQrViewUrl) ?? '')
  const [hasSaved, setHasSaved] = useState(Boolean(initial.gcashNumber))
  const [busy, setBusy] = useState<'save' | 'remove' | 'upload' | null>(null)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setError('')
    setBusy('upload')
    try {
      const body = new FormData()
      body.append('file', f)
      // A farmer's QR is public and saved with the form; a customer's is private and saved now.
      const res = await fetch(forFarmer ? '/api/upload' : '/api/users/me/gcash-qr', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Upload failed'); return }
      setQrUrl(forFarmer ? data.url : data.gcashQrViewUrl ?? '')
      setDone(forFarmer ? '' : 'QR code saved')
    } catch {
      setError('Upload failed. Please try again.')
    } finally {
      setBusy(null)
      if (file.current) file.current.value = ''
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDone('')
    setBusy('save')
    try {
      const res = await fetch('/api/users/me/gcash', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), number, qrUrl: forFarmer ? qrUrl || null : undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not save'); return }
      setNumber(fmtMobile(data.gcashNumber))
      setHasSaved(true)
      setDone('GCash details saved')
      onSaved?.(data)
    } catch {
      setError('Could not save')
    } finally {
      setBusy(null)
    }
  }

  async function takeQrOff() {
    if (forFarmer) { setQrUrl(''); return }
    setError('')
    setBusy('upload')
    try {
      const res = await fetch('/api/users/me/gcash-qr', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not remove the QR code'); return }
      setQrUrl('')
      setDone('QR code removed')
    } catch {
      setError('Could not remove the QR code')
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    const ok = await dialog.confirm({
      title: 'Remove your GCash details?',
      message: forFarmer
        ? 'Customers will no longer be able to choose GCash for your products until you add them again.'
        : 'You can still type them in when you pay.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    setError('')
    setDone('')
    setBusy('remove')
    try {
      const res = await fetch('/api/users/me/gcash', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not remove'); return }
      setName('')
      setNumber('')
      setQrUrl('')
      setHasSaved(false)
      setDone('GCash details removed')
      onSaved?.(data)
    } catch {
      setError('Could not remove')
    } finally {
      setBusy(null)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="text-sm text-gray-600">
        {forFarmer
          ? 'Customers pay GCash orders straight to this account, then enter the reference number for you to check. Without it, GCash shows as unavailable on your products.'
          : 'Saved here, these fill in the payment form when you pay a farmer by GCash. If an order is cancelled after you paid, the farmer sees them (and your QR code, if you add one) to send the refund.'}
      </p>
      <div>
        <label htmlFor="gcash-name" className="block text-sm font-medium text-gray-700 mb-1">Name on the GCash account</label>
        <input id="gcash-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy" />
      </div>
      <div>
        <label htmlFor="gcash-number" className="block text-sm font-medium text-gray-700 mb-1">GCash number</label>
        <input id="gcash-number" value={number} onChange={(e) => setNumber(e.target.value)} required inputMode="tel" autoComplete="off" placeholder="0917 123 4567"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy" />
      </div>

      {(forFarmer || hasSaved) && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-1">QR code <span className="font-normal text-gray-500">(optional)</span></p>
          <div className="flex items-center gap-4">
            <div className="relative w-24 h-24 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
              {qrUrl ? <Image src={qrUrl} alt="Your GCash QR code" fill unoptimized className="object-contain" /> : <QrCode size={32} className="text-gray-300" />}
              {busy === 'upload' && <div className="absolute inset-0 bg-white/70 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-paddy" /></div>}
            </div>
            <div className="space-y-1.5">
              <button type="button" onClick={() => file.current?.click()} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-paddy hover:underline disabled:opacity-50">
                <Upload size={14} /> {qrUrl ? 'Replace QR image' : 'Upload QR image'}
              </button>
              {qrUrl && (
                <button type="button" onClick={takeQrOff} disabled={busy !== null} className="block text-xs text-gray-500 hover:text-red-600">Take the QR off</button>
              )}
              <p className="text-xs text-gray-500">
                A screenshot of your GCash receive-money QR code. PNG, JPG or WEBP, max 4 MB.
                {!forFarmer && ' Only a farmer who owes you a refund can see it.'}
              </p>
            </div>
            <input ref={file} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} className="hidden" />
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {done && <p className="flex items-center gap-1.5 text-sm text-paddy"><CheckCircle size={15} /> {done}</p>}

      <div className="flex items-center gap-3 pt-1">
        <button type="submit" disabled={busy !== null}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-paddy text-white text-sm font-medium rounded-lg hover:bg-paddy-deep transition-colors disabled:opacity-60">
          {busy === 'save' && <Loader2 size={14} className="animate-spin" />}
          Save GCash details
        </button>
        {hasSaved && (
          <button type="button" onClick={remove} disabled={busy !== null}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 disabled:opacity-50">
            {busy === 'remove' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remove
          </button>
        )}
      </div>
    </form>
  )
}
