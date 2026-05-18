'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Megaphone, Trash2, AlertCircle, Plus, Info, AlertTriangle, Leaf } from 'lucide-react'

interface Announcement {
  id: number
  title: string
  body: string
  type: string
  createdAt: string
  author: { name: string; role: string }
}

const TYPE_CONFIG = {
  info:     { label: 'Info',     icon: Info,          badge: 'bg-blue-100 text-blue-700',   border: 'border-l-blue-500' },
  alert:    { label: 'Alert',    icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500' },
  advisory: { label: 'Advisory', icon: Leaf,           badge: 'bg-green-100 text-green-700', border: 'border-l-green-600' },
} as const

type AnnouncementType = keyof typeof TYPE_CONFIG

export default function AnnouncementsPage() {
  const { token } = useAuth()
  const [items, setItems]       = useState<Announcement[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [type, setType]         = useState<AnnouncementType>('info')
  const [posting, setPosting]   = useState(false)
  const [postError, setPostError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setItems(data)))
      .catch(() => setError('Failed to load announcements'))
      .finally(() => setLoading(false))
  }, [token])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !token) return
    setPosting(true)
    setPostError('')
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), type }),
      })
      const data = await res.json()
      if (!res.ok) { setPostError(data.error); return }
      setItems((prev) => [data, ...prev])
      setTitle('')
      setBody('')
      setType('info')
      titleRef.current?.focus()
    } catch {
      setPostError('Failed to post announcement')
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this announcement?')) return
    if (!token) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { alert(data.error); return }
      setItems((prev) => prev.filter((a) => a.id !== id))
    } catch {
      alert('Failed to delete announcement')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
        <span className="text-sm text-gray-500">{items.length} posted</span>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {/* Post form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Plus size={14} /> New Announcement
        </h2>
        <form onSubmit={handlePost} className="space-y-3">
          <div className="flex gap-3">
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AnnouncementType)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {(Object.keys(TYPE_CONFIG) as AnnouncementType[]).map((t) => (
                <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write the announcement body…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          {postError && (
            <p className="text-red-500 text-xs flex items-center gap-1">
              <AlertCircle size={12} /> {postError}
            </p>
          )}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={posting || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
              Post
            </button>
          </div>
        </form>
      </div>

      {/* Announcements list */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Megaphone size={36} className="mx-auto mb-3" />
          <p>No announcements yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((a) => {
            const cfg = TYPE_CONFIG[a.type as AnnouncementType] ?? TYPE_CONFIG.info
            const Icon = cfg.icon
            return (
              <div
                key={a.id}
                className={`bg-white rounded-xl border border-gray-200 border-l-4 ${cfg.border} shadow-sm p-5`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        <Icon size={10} /> {cfg.label}
                      </span>
                      <h3 className="font-semibold text-gray-900 text-sm">{a.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      Posted by {a.author.name} · {new Date(a.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Delete"
                  >
                    {deletingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
