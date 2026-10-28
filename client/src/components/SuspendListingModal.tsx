'use client'

import { useState } from 'react'
import { Ban, Loader2, X } from 'lucide-react'
import { SUSPENSION_DAYS, SUSPENSION_REASONS, type SuspensionReason } from '@/validators/productSuspension'
import { MAX } from '@/validators/limits'

const REASONS = Object.entries(SUSPENSION_REASONS) as [SuspensionReason, string][]

export interface SuspendResult {
  suspendedAt: string
  suspensionReasons: string[]
  emailSent: boolean
}

/** Staff pick the reasons for suspending a listing; the farmer is notified in Messages and by email. */
export default function SuspendListingModal({
  product,
  token,
  onDone,
  onCancel,
}: {
  product: { id: number; name: string; farmer: { name: string } }
  token: string
  onDone: (result: SuspendResult & { suspensionNote: string | null }) => void
  onCancel: () => void
}) {
  const [reasons, setReasons] = useState<SuspensionReason[]>([])
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const needsNote = reasons.includes('other') && !note.trim()

  function toggle(reason: SuspensionReason) {
    setReasons((prev) => (prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (reasons.length === 0 || needsNote) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/products/${product.id}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reasons, note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to suspend listing'); return }
      onDone({ ...data, suspensionNote: note.trim() || null })
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onCancel} />
      <form onSubmit={handleSubmit} className="relative bg-white rounded-card shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-soil">Suspend listing</h3>
          <button type="button" onClick={onCancel} className="text-gray-500 hover:text-gray-600" aria-label="Cancel">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-gray-600">
          <span className="font-medium text-soil">{product.name}</span> by {product.farmer.name} will be hidden from customers.
          The farmer is notified in Messages and by email, and has {SUSPENSION_DAYS} days to edit and resubmit it before it is
          deleted. Orders already placed are not affected.
        </p>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-gray-700 mb-1">Reasons</legend>
          {REASONS.map(([key, label]) => (
            <label key={key} className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={reasons.includes(key)}
                onChange={() => toggle(key)}
                className="mt-0.5 accent-red-600"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Note to the farmer <span className="text-gray-500">{reasons.includes('other') ? '(required for "Other")' : '(optional)'}</span>
          </label>
          <textarea aria-label="Note to the farmer"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={MAX.suspensionNote}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || reasons.length === 0 || needsNote}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
            Suspend
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 font-medium py-2.5 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
