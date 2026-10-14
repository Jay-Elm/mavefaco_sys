'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft, Bell, Loader2, Pencil } from 'lucide-react'

interface Notice {
  id: number
  title: string
  body: string
  read: boolean
  createdAt: string
  product: { id: number; name: string; archivedAt: string | null; suspendedAt: string | null } | null
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
          fetch('/api/notices/read', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
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
              {n.product && !n.product.archivedAt ? (
                <Link
                  href={`/farmer/products/${n.product.id}/edit`}
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-forest text-white hover:bg-forest-mid transition-colors"
                >
                  <Pencil size={14} />
                  {n.product.suspendedAt ? 'Edit or delete this listing' : 'Open this listing'}
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
