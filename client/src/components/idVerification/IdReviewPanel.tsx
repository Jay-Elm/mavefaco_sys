'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Camera, CheckCircle, ImageUp, Loader2, X, XCircle } from 'lucide-react'
import { ID_REJECTION_REASONS, idTypeLabel, type IdRejectionReason } from '@/lib/idVerification'
import { idReasonLabels } from '@/validators/idReview'

interface Review {
  farmer: { id: number; name: string; verified: boolean; verifiedInPersonAt: string | null }
  submission: null | {
    id: number
    idType: string
    numberLast4: string | null
    captureMethod: 'camera' | 'upload' | 'legacy'
    status: 'pending' | 'approved' | 'rejected'
    rejectionReasons: string[]
    rejectionNote: string | null
    createdAt: string
    reviewedAt: string | null
    imagesPurgedAt: string | null
    images: { front: string | null; back: string | null; selfie: string | null }
  }
  previousRejections: number
  sameNumber: { userId: number; name: string; status: string; createdAt: string }[]
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium' })
const REASONS = Object.entries(ID_REJECTION_REASONS) as [IdRejectionReason, string][]

/** Staff view of a farmer's ID submission: the three photos side by side, and approve or reject with reasons. */
export default function IdReviewPanel({ token, userId, onClose, onReviewed }: {
  token: string
  userId: number
  onClose: () => void
  onReviewed: (status: 'approved' | 'rejected') => void
}) {
  const [data, setData] = useState<Review | null>(null)
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [reasons, setReasons] = useState<IdRejectionReason[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`/api/admin/users/${userId}/id-submission`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setData(d)))
      .catch(() => setError('Failed to load the submission'))
  }, [token, userId])

  async function decide(decision: 'approve' | 'reject') {
    if (!data?.submission) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/admin/id-submissions/${data.submission.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(decision === 'approve' ? { decision } : { decision, reasons, note: note.trim() || undefined }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error ?? 'Failed to save the review'); return }
      onReviewed(body.status)
    } catch {
      setError('Request failed')
    } finally {
      setSaving(false)
    }
  }

  const s = data?.submission
  const photos = s ? ([['Front', s.images.front], ...(s.images.back || s.idType !== 'passport' ? [['Back', s.images.back]] : []), ['Selfie with ID', s.images.selfie]] as [string, string | null][]) : []

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-2 sm:p-6 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="id-review-title">
      <div className="bg-white rounded-card shadow-xl w-full max-w-4xl my-4">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <h2 id="id-review-title" className="font-semibold text-soil">ID review{data ? `: ${data.farmer.name}` : ''}</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5">
          {!data && !error && <div className="py-12 flex justify-center text-gray-500"><Loader2 size={24} className="animate-spin" /></div>}
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          {data && !s && <p className="text-sm text-gray-500">This farmer hasn&apos;t submitted an ID.</p>}

          {s && (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm mb-4">
                <span><span className="text-gray-500">ID:</span> <span className="font-medium text-soil">{idTypeLabel(s.idType)}</span></span>
                {s.numberLast4 && <span><span className="text-gray-500">Number ends in</span> <span className="font-mono font-medium text-soil">{s.numberLast4}</span></span>}
                <span><span className="text-gray-500">Submitted</span> {fmt(s.createdAt)}</span>
                <span className={`inline-flex items-center gap-1 ${s.captureMethod === 'camera' ? 'text-paddy' : 'text-amber-700'}`}>
                  {s.captureMethod === 'camera' ? <Camera size={14} /> : <ImageUp size={14} />}
                  {s.captureMethod === 'camera' ? 'Taken with the in-app camera' : s.captureMethod === 'upload' ? 'Uploaded, not taken with the camera' : 'Uploaded before the camera flow'}
                </span>
              </div>

              {(data.sameNumber.length > 0 || data.previousRejections > 0) && (
                <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900">
                  <p className="font-medium flex items-center gap-1.5"><AlertTriangle size={15} /> Check carefully</p>
                  {data.sameNumber.length > 0 && (
                    <p className="mt-1">The same ID number was submitted by: {data.sameNumber.map((o) => `${o.name} (${o.status}, ${fmt(o.createdAt)})`).join('; ')}.</p>
                  )}
                  {data.previousRejections > 0 && <p className="mt-1">This farmer had {data.previousRejections} earlier submission(s) rejected.</p>}
                </div>
              )}

              {s.imagesPurgedAt ? (
                <p className="text-sm text-gray-500 mb-4">The photos were deleted on {fmt(s.imagesPurgedAt)}, 30 days after review.</p>
              ) : (
                <div className={`grid gap-3 mb-4 ${photos.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  {photos.map(([label, url]) => (
                    <figure key={label}>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" title="Open full size">
                          {/* eslint-disable-next-line @next/next/no-img-element -- a 5-minute signed link to a private image */}
                          <img src={url} alt={label} className="w-full aspect-[4/3] object-contain bg-gray-100 rounded-lg border border-gray-200" />
                        </a>
                      ) : (
                        <div className="w-full aspect-[4/3] rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-500">Not provided</div>
                      )}
                      <figcaption className="text-xs text-gray-600 mt-1">{label}</figcaption>
                    </figure>
                  ))}
                </div>
              )}

              {s.status === 'pending' ? (
                rejecting ? (
                  <div className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm font-medium text-soil mb-2">Why isn&apos;t it approved?</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {REASONS.map(([key, label]) => (
                        <label key={key} className="flex items-start gap-2 text-sm text-gray-700">
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-paddy"
                            checked={reasons.includes(key)}
                            onChange={(e) => setReasons((r) => (e.target.checked ? [...r, key] : r.filter((x) => x !== key)))}
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={2}
                      placeholder={reasons.includes('other') ? 'Explain the other reason (required)' : 'Note to the farmer (optional)'}
                      className="mt-3 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy resize-none"
                      aria-label="Note to the farmer"
                    />
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => decide('reject')}
                        disabled={saving || reasons.length === 0 || (reasons.includes('other') && !note.trim())}
                        className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
                      >
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />} Reject and notify farmer
                      </button>
                      <button onClick={() => setRejecting(false)} className="text-sm text-gray-600 hover:text-soil">Back</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => decide('approve')} disabled={saving} className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />} Approve and verify
                    </button>
                    <button onClick={() => setRejecting(true)} disabled={saving} className="inline-flex items-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium px-4 py-2 rounded-lg">
                      <XCircle size={14} /> Reject
                    </button>
                    <p className="text-xs text-gray-500">Compare the selfie with the ID photo, and the name with the account&apos;s name.</p>
                  </div>
                )
              ) : (
                <p className="text-sm text-gray-600">
                  {s.status === 'approved' ? 'Approved' : 'Rejected'}{s.reviewedAt ? ` on ${fmt(s.reviewedAt)}` : ''}
                  {s.status === 'rejected' && s.rejectionReasons.length > 0 && `: ${idReasonLabels(s.rejectionReasons).join('; ')}`}
                  {s.rejectionNote && ` (${s.rejectionNote})`}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
