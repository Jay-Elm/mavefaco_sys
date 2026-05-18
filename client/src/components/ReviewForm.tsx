'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Star, Loader2, Send } from 'lucide-react'

interface Props {
  productId: number
  onSubmitted: (review: { id: number; rating: number; comment: string | null; createdAt: string; customer: { id: number; name: string } }) => void
}

export default function ReviewForm({ productId, onSubmitted }: Props) {
  const { token, user, isAuthenticated } = useAuth()
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (!isAuthenticated || user?.role !== 'customer') return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (rating === 0) { setError('Please select a star rating'); return }
    if (!token) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); return }
      onSubmitted(data)
      setRating(0)
      setComment('')
    } catch {
      setError('Failed to submit review')
    } finally {
      setSubmitting(false)
    }
  }

  const display = hovered || rating

  return (
    <form onSubmit={handleSubmit} className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-3">
      <p className="text-sm font-semibold text-gray-700">Write a Review</p>

      {/* Star selector */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              size={24}
              className={s <= display ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-500 self-center">
            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][rating]}
          </span>
        )}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience (optional)…"
        rows={3}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
      />

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitting || rating === 0}
          className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          Submit Review
        </button>
      </div>
    </form>
  )
}
