'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Megaphone, Trash2, AlertCircle, Plus, Info, AlertTriangle, Leaf, Pin, PinOff } from 'lucide-react'
import { useDialog } from '@/contexts/DialogContext'
import { ANNOUNCEMENT_AUDIENCES, type AnnouncementAudience } from '@/validators/announcement'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import { ANNOUNCEMENT_DRAFT_KEY } from '@/components/AiReportPanel'

interface Announcement {
  id: number
  title: string
  body: string
  type: string
  audience: AnnouncementAudience
  createdAt: string
  pinnedAt: string | null
  author: { name: string; role: string }
}

const ms = (d: string | null) => (d ? new Date(d).getTime() : 0)
/** Pinned first (newest pin first), then newest first, as the site shows them. */
const pinnedFirst = (a: Announcement, b: Announcement) => ms(b.pinnedAt) - ms(a.pinnedAt) || ms(b.createdAt) - ms(a.createdAt)

const TYPE_CONFIG = {
  info:     { label: 'Info',     icon: Info,          badge: 'bg-blue-100 text-blue-700',   border: 'border-l-blue-500' },
  alert:    { label: 'Alert',    icon: AlertTriangle, badge: 'bg-amber-100 text-amber-700', border: 'border-l-amber-500' },
  advisory: { label: 'Advisory', icon: Leaf,           badge: 'bg-shoot text-paddy', border: 'border-l-paddy' },
} as const

type AnnouncementType = keyof typeof TYPE_CONFIG

// Where each audience's announcements appear.
const AUDIENCE_CONFIG: Record<AnnouncementAudience, { label: string; where: string }> = {
  everyone:  { label: 'Everyone',  where: 'Home page and farmer dashboard' },
  farmers:   { label: 'Farmers',   where: 'Farmer dashboard only' },
  customers: { label: 'Customers', where: 'Home page only' },
}

export default function AnnouncementsPage() {
  const { token } = useAuth()
  const live = useLiveVersion()
  const dialog = useDialog()
  const [items, setItems]       = useState<Announcement[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [type, setType]         = useState<AnnouncementType>('info')
  const [audience, setAudience] = useState<AnnouncementAudience>('everyone')
  const [posting, setPosting]   = useState(false)
  const [postError, setPostError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [pinningId, setPinningId] = useState<number | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  // A draft handed over from the AI crop report: fill the form once, then forget it.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(ANNOUNCEMENT_DRAFT_KEY)
      if (!raw) return
      sessionStorage.removeItem(ANNOUNCEMENT_DRAFT_KEY)
      const d = JSON.parse(raw) as { title?: string; body?: string; type?: string; audience?: string }
      /* eslint-disable react-hooks/set-state-in-effect -- one-time hand-off from another page */
      if (d.title) setTitle(d.title.slice(0, 150))
      if (d.body) setBody(d.body.slice(0, 5000))
      if (d.type && d.type in TYPE_CONFIG) setType(d.type as AnnouncementType)
      if (d.audience && (ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(d.audience)) setAudience(d.audience as AnnouncementAudience)
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {
      // No storage, or a damaged draft: start with an empty form.
    }
  }, [])

  useEffect(() => {
    if (!token) return
    fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setItems(data)))
      .catch(() => setError('Failed to load announcements'))
      .finally(() => setLoading(false))
  }, [token, live])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !token) return
    setPosting(true)
    setPostError('')
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), type, audience }),
      })
      const data = await res.json()
      if (!res.ok) { setPostError(data.error); return }
      setItems((prev) => [data, ...prev].sort(pinnedFirst))
      setTitle('')
      setBody('')
      setType('info')
      setAudience('everyone')
      titleRef.current?.focus()
    } catch {
      setPostError('Failed to post announcement')
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id: number) {
    if (!(await dialog.confirm({ title: 'Delete this announcement?', message: 'Nobody will see it any more.', confirmLabel: 'Delete', tone: 'danger' }))) return
    if (!token) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { await dialog.alert({ title: "Couldn't delete announcement", message: data.error }); return }
      setItems((prev) => prev.filter((a) => a.id !== id))
    } catch {
      await dialog.alert({ title: "Couldn't delete announcement", message: 'Please try again.' })
    } finally {
      setDeletingId(null)
    }
  }

  async function handlePin(a: Announcement) {
    if (!token) return
    setPinningId(a.id)
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pinned: !a.pinnedAt }),
      })
      const data = await res.json()
      if (!res.ok) { await dialog.alert({ title: a.pinnedAt ? "Couldn't unpin" : "Couldn't pin", message: data.error }); return }
      setItems((prev) => prev.map((x) => (x.id === a.id ? data : x)).sort(pinnedFirst))
    } catch {
      await dialog.alert({ title: a.pinnedAt ? "Couldn't unpin" : "Couldn't pin", message: 'Please try again.' })
    } finally {
      setPinningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-soil">Announcements</h1>
        <span className="text-sm text-gray-500">{items.length} posted</span>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {/* Post form */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Plus size={14} /> New Announcement
        </h2>
        <form onSubmit={handlePost} className="space-y-3">
          <div className="flex gap-3">
            <input aria-label="Title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
            <select
              aria-label="Announcement type"
              value={type}
              onChange={(e) => setType(e.target.value as AnnouncementType)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            >
              {(Object.keys(TYPE_CONFIG) as AnnouncementType[]).map((t) => (
                <option key={t} value={t}>{TYPE_CONFIG[t].label}</option>
              ))}
            </select>
          </div>
          <textarea aria-label="Write the announcement body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write the announcement body…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy resize-none"
          />
          {postError && (
            <p className="text-red-500 text-xs flex items-center gap-1">
              <AlertCircle size={12} /> {postError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              Show to
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
              >
                {ANNOUNCEMENT_AUDIENCES.map((a) => (
                  <option key={a} value={a}>{AUDIENCE_CONFIG[a].label}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">{AUDIENCE_CONFIG[audience].where}</span>
            </label>
            <button
              type="submit"
              disabled={posting || !title.trim() || !body.trim()}
              className="inline-flex items-center gap-2 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Megaphone size={14} />}
              Post
            </button>
          </div>
        </form>
      </div>

      {/* Announcements list */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
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
                className={`bg-white rounded-lg border border-gray-200 border-l-4 ${cfg.border} shadow-sm p-5`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>
                        <Icon size={10} /> {cfg.label}
                      </span>
                      {a.pinnedAt && (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-soil text-white">
                          <Pin size={10} /> Pinned
                        </span>
                      )}
                      <h3 className="font-semibold text-soil text-sm">{a.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      For {(AUDIENCE_CONFIG[a.audience] ?? AUDIENCE_CONFIG.everyone).label.toLowerCase()} · Posted by {a.author.name} · {new Date(a.createdAt).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => handlePin(a)}
                    disabled={pinningId === a.id}
                    className={`p-1.5 transition-colors disabled:opacity-40 ${a.pinnedAt ? 'text-soil hover:text-gray-500' : 'text-gray-500 hover:text-soil'}`}
                    title={a.pinnedAt ? 'Unpin' : 'Pin: show it first to its audience'}
                    aria-label={a.pinnedAt ? 'Unpin' : 'Pin'}
                    aria-pressed={!!a.pinnedAt}
                  >
                    {pinningId === a.id ? <Loader2 size={14} className="animate-spin" /> : a.pinnedAt ? <PinOff size={14} /> : <Pin size={14} />}
                  </button>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deletingId === a.id}
                    className="p-1.5 text-gray-500 hover:text-red-500 transition-colors disabled:opacity-40"
                    title="Delete" aria-label="Delete"
                  >
                    {deletingId === a.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
