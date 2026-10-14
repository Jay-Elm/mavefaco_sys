'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Bell, CheckCircle, Loader2, Pencil, Trash2 } from 'lucide-react'
import { refreshNavBadges } from '@/components/NavBadge'

interface Notice {
  id: number
  title: string
  body: string
  read: boolean
  createdAt: string
  resolvedAt: string | null
  resolution: 'resubmitted' | 'removed' | null
  product: { id: number; name: string; approved: boolean; archivedAt: string | null; suspendedAt: string | null } | null
}

const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium' })

/** Where the listing stands now, after a resubmission. */
function afterResubmit(product: Notice['product']): string {
  if (!product || product.archivedAt) return 'the listing has since been removed'
  if (product.suspendedAt) return 'suspended again since (see the newer notice)'
  return product.approved ? 'approved by staff' : 'waiting for staff review'
}

/** System notices from MaVeFaCo. One-way: there is no reply box. */
export default function FarmerNoticesPage() {
  const { token } = useAuth()
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    fetch('/api/notices', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => {
        if (!Array.isArray(d)) return
        setNotices(d)
        if (d.some((n: Notice) => !n.read))
          fetch('/api/notices/read', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).then(refreshNavBadges)
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <Link href="/farmer/messages" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-forest mb-6 transition-colors">
        <ArrowLeft size={16} /> Back to Messages
      </Link>
      <div className="flex items-center gap-3 mb-6">
        <Bell size={22} className="text-forest" />
        <h1 className="font-serif text-2xl font-bold text-gray-900">MaVeFaCo notices</h1>
      </div>

      {notices.length === 0 ? (
        <p className="text-center py-16 text-gray-400">No notices.</p>
      ) : (
        <div className="space-y-4">
          {notices.map((n) => (
            <div key={n.id} className={`bg-white rounded-xl border shadow-sm p-5 ${n.read ? 'border-gray-200' : 'border-red-300'}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                <p className="text-xs text-gray-400 shrink-0">
                  {new Date(n.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <p className="text-sm text-gray-700 mt-2 whitespace-pre-line">{n.body}</p>
              {/* Resolved notices show what happened instead of an action. */}
              {n.resolution === 'resubmitted' && n.resolvedAt ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-lg">
                  <CheckCircle size={14} />
                  Resubmitted on {fmtDate(n.resolvedAt)}: {afterResubmit(n.product)}
                </p>
              ) : n.resolution === 'removed' && n.resolvedAt ? (
                <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 bg-gray-100 px-3 py-1.5 rounded-lg">
                  <Trash2 size={14} />
                  Listing deleted on {fmtDate(n.resolvedAt)}
                </p>
              ) : n.product && !n.product.archivedAt ? (
                <Link
                  href={`/farmer/products/${n.product.id}/edit`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-forest text-white hover:bg-forest-mid transition-colors"
                >
                  <Pencil size={14} />
                  Edit or delete this listing
                </Link>
              ) : (
                <p className="mt-3 text-xs text-gray-400">This listing has since been removed.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
