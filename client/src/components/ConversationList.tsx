'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Loader2, MessageCircle, User, Search, Trash2, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import { useDialog } from '@/contexts/DialogContext'
import { refreshNavBadges } from '@/components/NavBadge'

interface Conversation {
  user: { id: number; name: string; role: string }
  lastMessage: string
  lastAt: string
  unread: number
  match?: { content: string; createdAt: string }
}

/** Time for today's messages, the date for older ones. */
export function when(iso: string): string {
  const d = new Date(iso)
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  return day(d) === day(new Date())
    ? d.toLocaleTimeString('en-PH', { timeStyle: 'short', timeZone: 'Asia/Manila' })
    : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
}

/** The matched words in bold, with a little text either side. */
function Highlight({ text, query }: { text: string; query: string }) {
  const i = text.toLowerCase().indexOf(query.toLowerCase())
  if (i === -1 || !query) return <>{text}</>
  const start = Math.max(0, i - 30)
  return (
    <>
      {start > 0 && '…'}{text.slice(start, i)}
      <mark className="bg-calamansi/50 text-soil rounded-sm px-0.5">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  )
}

/**
 * The signed-in user's conversations, newest first, with a search over names
 * and every message's text, and a delete button that removes a conversation
 * from this user's list only. Used by the customer and farmer Messages pages.
 */
export default function ConversationList({
  basePath,
  empty,
  above,
}: {
  /** Where a conversation opens, e.g. /farmer/messages (the other user's id is appended). */
  basePath: string
  /** Shown when there are no conversations and no search. */
  empty: ReactNode
  /** Pinned above the search box (the farmer's notices). */
  above?: ReactNode
}) {
  const { token } = useAuth()
  const live = useLiveVersion()
  const dialog = useDialog()
  const [convs, setConvs] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  // The query the shown list was searched with (it lags typing slightly).
  const [searched, setSearched] = useState('')
  const [removing, setRemoving] = useState<number | null>(null)
  const [error, setError] = useState('')

  // Searched on the server so it can look inside every message, not just
  // the last one. Waits for a pause in typing.
  useEffect(() => {
    if (!token) return
    const q = query.trim()
    let cancelled = false
    const timer = setTimeout(() => {
      fetch(`/api/messages${q ? `?q=${encodeURIComponent(q)}` : ''}`, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.json())
        .then((c) => {
          if (cancelled || !Array.isArray(c)) return
          setConvs(c)
          setSearched(q)
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, q ? 250 : 0)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [token, live, query])

  async function remove(c: Conversation) {
    if (!token) return
    const ok = await dialog.confirm({
      title: `Delete your conversation with ${c.user.name}?`,
      message: `It is removed from your Messages only. ${c.user.name} keeps their copy, and if either of you writes again the conversation comes back with just the new messages.`,
      confirmLabel: 'Delete conversation',
      tone: 'danger',
    })
    if (!ok) return
    setRemoving(c.user.id)
    setError('')
    try {
      const res = await fetch(`/api/messages/${c.user.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) { setError((await res.json()).error ?? 'Could not delete the conversation'); return }
      setConvs((prev) => prev.filter((x) => x.user.id !== c.user.id))
      refreshNavBadges()
    } catch {
      setError('Could not delete the conversation')
    } finally {
      setRemoving(null)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  const searching = searched !== ''

  return (
    <>
      {above}

      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search names and messages, e.g. ampalaya"
          aria-label="Search conversations"
          className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-paddy"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-soil">
            <X size={15} />
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {convs.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <MessageCircle size={40} className="mx-auto mb-3" />
          {searching ? <p>No conversations mention “{searched}”.</p> : empty}
        </div>
      ) : (
        <>
          {searching && (
            <p className="mb-2 text-xs text-gray-600">
              {convs.length} conversation{convs.length === 1 ? '' : 's'} mention “{searched}”
            </p>
          )}
          <ul className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
            {convs.map((c) => (
              <li key={c.user.id} className="group relative flex items-center hover:bg-gray-50 transition-colors">
                <Link href={`${basePath}/${c.user.id}`} className="flex-1 min-w-0 flex items-center gap-4 pl-5 pr-2 py-4">
                  <div className="w-10 h-10 rounded-full bg-field flex items-center justify-center shrink-0">
                    <User size={18} className="text-paddy" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm text-soil ${c.unread > 0 ? 'font-bold' : 'font-medium'}`}>{c.user.name}</p>
                      {/* Always the other side (farmer or customer); not worth the room on a phone */}
                      <span className="max-sm:hidden text-xs text-gray-500 capitalize">{c.user.role}</span>
                      {c.unread > 0 && (
                        <span className="ml-auto bg-paddy text-white text-xs font-bold px-2 py-0.5 rounded-full">{c.unread}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 truncate mt-0.5">
                      {c.match ? <Highlight text={c.match.content} query={searched} /> : c.lastMessage}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 shrink-0 tabular">{when(c.match?.createdAt ?? c.lastAt)}</p>
                </Link>
                <button
                  type="button"
                  onClick={() => remove(c)}
                  disabled={removing === c.user.id}
                  aria-label={`Delete conversation with ${c.user.name}`}
                  title="Delete conversation"
                  className="shrink-0 mr-3 p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40"
                >
                  {removing === c.user.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  )
}
