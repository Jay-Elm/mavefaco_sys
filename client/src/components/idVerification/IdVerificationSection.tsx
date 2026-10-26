'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, Loader2, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useDialog } from '@/contexts/DialogContext'
import { refreshNavBadges } from '@/components/NavBadge'
import { idTypeLabel } from '@/lib/idVerification'
import { idReasonLabels } from '@/validators/idReview'
import IdVerificationFlow from './IdVerificationFlow'

interface Submission {
  id: number
  idType: string
  numberLast4: string | null
  status: 'pending' | 'approved' | 'rejected'
  rejectionReasons: string[]
  rejectionNote: string | null
  createdAt: string
  reviewedAt: string | null
}
interface Me {
  verified: boolean
  verifiedInPersonAt: string | null
  idSubmission: Submission | null
}

const fmt = (d: string) => new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium' })

/** The farmer's ID verification status, and the capture flow to submit an ID. */
export default function IdVerificationSection({ token }: { token: string }) {
  const dialog = useDialog()
  const [me, setMe] = useState<Me | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [justSubmitted, setJustSubmitted] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMe({ verified: d.verified, verifiedInPersonAt: d.verifiedInPersonAt, idSubmission: d.idSubmission }) })
      .catch(() => setError('Failed to load your verification status'))
  }, [token])
  useEffect(() => { load() }, [load])

  async function withdraw() {
    if (!(await dialog.confirm({ title: 'Withdraw your ID submission?', message: 'Its photos are deleted. You will need to submit your ID again to be verified.', confirmLabel: 'Withdraw', tone: 'danger' }))) return
    setWithdrawing(true); setError('')
    try {
      const res = await fetch('/api/users/me/id-submission', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Failed to withdraw'); return }
      setJustSubmitted(false)
      load()
      refreshNavBadges()
    } finally {
      setWithdrawing(false)
    }
  }

  if (!me) return <div className="py-6 text-gray-400"><Loader2 size={20} className="animate-spin" /></div>

  const sub = me.idSubmission
  const status = me.verified ? 'verified' : sub?.status === 'pending' ? 'pending' : sub?.status === 'rejected' ? 'rejected' : 'none'
  const badge = {
    verified: { cls: 'text-green-700 bg-green-100', icon: ShieldCheck, label: me.verifiedInPersonAt ? 'Verified in person' : 'Verified' },
    pending: { cls: 'text-amber-700 bg-amber-100', icon: Clock, label: 'Pending review' },
    rejected: { cls: 'text-red-700 bg-red-100', icon: ShieldAlert, label: 'Not approved' },
    none: { cls: 'text-amber-700 bg-amber-100', icon: ShieldAlert, label: 'Not submitted' },
  }[status]
  const Badge = badge.icon

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-lg font-semibold text-gray-900">ID Verification</h2>
        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
          <Badge size={12} /> {badge.label}
        </span>
      </div>

      {error && <p className="mb-3 text-red-600 text-sm">{error}</p>}

      {status === 'verified' && (
        <p className="text-sm text-gray-500">
          Your account is verified{me.verifiedInPersonAt ? ' by cooperative staff in person' : ''}. You can list products for sale.
        </p>
      )}

      {status === 'pending' && sub && (
        <div>
          {justSubmitted && (
            <p className="mb-3 flex items-center gap-2 text-green-700 text-sm"><CheckCircle size={16} /> ID submitted for review</p>
          )}
          <div className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
            Your {idTypeLabel(sub.idType)}{sub.numberLast4 ? ` ending in ${sub.numberLast4}` : ''} was submitted on {fmt(sub.createdAt)} and is waiting for staff review.
            You&apos;ll get a message and an email when it&apos;s reviewed.
          </div>
          <button type="button" onClick={withdraw} disabled={withdrawing} className="mt-3 text-sm text-red-500 hover:text-red-700 inline-flex items-center gap-1 disabled:opacity-50">
            {withdrawing ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />} Withdraw submission
          </button>
        </div>
      )}

      {(status === 'none' || status === 'rejected') && !capturing && (
        <div>
          {status === 'rejected' && sub && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-900">
              <p className="font-medium flex items-center gap-1.5"><AlertTriangle size={15} /> Your {idTypeLabel(sub.idType)} wasn&apos;t approved</p>
              <ul className="list-disc ml-5 mt-1">
                {idReasonLabels(sub.rejectionReasons).map((r) => <li key={r}>{r}</li>)}
              </ul>
              {sub.rejectionNote && <p className="mt-1">Note from staff: {sub.rejectionNote}</p>}
            </div>
          )}
          <p className="text-sm text-gray-500 mb-4">
            To sell on MaVeFaCo, verify your identity with a government-issued ID. You&apos;ll take photos of the front and back
            and a selfie holding the ID. They&apos;re stored privately, seen only by cooperative staff, and deleted 30 days after review.
            You can also have your ID checked in person at the cooperative office.
          </p>
          <button
            type="button"
            onClick={() => { setCapturing(true); setError('') }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-forest text-white text-sm font-medium rounded-lg hover:bg-forest-mid transition-colors"
          >
            {status === 'rejected' ? 'Submit your ID again' : 'Verify my ID'}
          </button>
        </div>
      )}

      {capturing && (
        <IdVerificationFlow
          token={token}
          onCancel={() => setCapturing(false)}
          onSubmitted={() => { setCapturing(false); setJustSubmitted(true); load(); refreshNavBadges() }}
        />
      )}
    </div>
  )
}
