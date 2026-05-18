'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Star, Trash2, Loader2, MessageSquare } from 'lucide-react'
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
          className={s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}
        />
      ))}
    </div>
  )
}

export default function ReviewsSection({ productId }: { productId: number }) {
  const { user, token } = useAuth()
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

  async function handleDelete(reviewId: number) {
    if (!token) return
    setDeletingId(reviewId)
    try {
      await fetch(`/api/products/${productId}/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      setReviews((prev) => prev.filter((r) => r.id !== reviewId))
    } catch {}
    finally { setDeletingId(null) }
  }

  const canDelete = (r: Review) =>
    user?.id === r.customer.id || user?.role === 'admin' || user?.role === 'manager'

  return (
    <div className="mt-10 border-t border-gray-100 pt-8">
      {/* Header + summary */}
      <div className="flex items-center gap-4 mb-6">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <MessageSquare size={18} className="text-green-600" />
          Reviews
        </h2>
        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <StarDisplay rating={Math.round(avg)} size={16} />
            <span className="text-sm font-semibold text-gray-700">{avg.toFixed(1)}</span>
            <span className="text-sm text-gray-400">({reviews.length})</span>
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
        <div className="flex justify-center py-8 text-gray-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No reviews yet. Be the first to review this product!
        </p>
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StarDisplay rating={r.rating} />
                    <span className="text-xs font-semibold text-gray-700">{r.customer.name}</span>
                    {r.customer.id === user?.id && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">You</span>
                    )}
                  </div>
                  {r.comment && (
                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.comment}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1.5">
                    {new Date(r.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                  </p>
                </div>
                {canDelete(r) && (
                  <button
                    onClick={() => handleDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Delete review"
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
