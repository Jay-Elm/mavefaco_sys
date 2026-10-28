'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useDialog } from '@/contexts/DialogContext'
import { Star, Trash2, Loader2 } from 'lucide-react'
import ReviewForm from './ReviewForm'

interface Review {
  id: number
  rating: number
  comment: string | null
  createdAt: string
  customer: { id: number; name: string }
}

function StarDisplay({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={s <= rating ? 'fill-calamansi text-calamansi' : 'text-gray-300'}
        />
      ))}
    </div>
  )
}

export default function ReviewsSection({ productId }: { productId: number }) {
  const { user, token } = useAuth()
  const dialog = useDialog()
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/products/${productId}/reviews`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setReviews(data) })
      .finally(() => setLoading(false))
  }, [productId])

  const hasReviewed = reviews.some((r) => r.customer.id === user?.id)
  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0

  async function handleDelete(r: Review) {
    if (!token) return
    const own = r.customer.id === user?.id
    if (!(await dialog.confirm({
      title: own ? 'Delete your review?' : `Delete ${r.customer.name}'s review?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete review',
      tone: 'danger',
    }))) return
    setDeletingId(r.id)
    try {
      const res = await fetch(`/api/products/${productId}/reviews/${r.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        await dialog.alert({ title: "Couldn't delete the review", message: data.error ?? 'Please try again.' })
        return
      }
      setReviews((prev) => prev.filter((x) => x.id !== r.id))
    } catch {
      await dialog.alert({ title: "Couldn't delete the review", message: 'Please check your connection and try again.' })
    } finally { setDeletingId(null) }
  }

  const canDelete = (r: Review) =>
    user?.id === r.customer.id || user?.role === 'admin' || user?.role === 'manager'

  return (
    <div className="mt-12 border-t border-gray-200 pt-8">
      {/* Header + summary */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="font-display text-4xl font-bold">
          Reviews
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <StarDisplay rating={Math.round(avg)} size={16} />
            <span className="text-sm font-semibold tabular">{avg.toFixed(1)}</span>
            <span className="text-sm text-gray-600 tabular">({reviews.length})</span>
          </div>
        )}
      </div>

      {/* Submit form — only for eligible customers who haven't reviewed */}
      {!hasReviewed && (
        <div className="mb-6">
          <ReviewForm
            productId={productId}
            onSubmitted={(r) => setReviews((prev) => [r, ...prev])}
          />
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex justify-center py-8 text-gray-500">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-gray-600 py-4">
          {user?.role === 'customer' || !user ? 'No reviews yet. Customers who received this product can review it.' : 'No reviews yet.'}
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StarDisplay rating={r.rating} />
                    <span className="text-sm font-semibold">{r.customer.name}</span>
                    {r.customer.id === user?.id && (
                      <span className="text-xs bg-shoot text-paddy px-1.5 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="text-[0.95rem] text-gray-700 mt-1 leading-relaxed whitespace-pre-wrap">{r.comment}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1.5">
                    {new Date(r.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                  </p>
                </div>
                {canDelete(r) && (
                  <button
                    onClick={() => handleDelete(r)}
                    disabled={deletingId === r.id}
                    className="shrink-0 p-1.5 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Delete review" aria-label="Delete review"
                  >
                    {deletingId === r.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <Trash2 size={14} />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
