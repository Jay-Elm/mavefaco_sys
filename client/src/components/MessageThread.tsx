'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Send } from 'lucide-react'
import { refreshNavBadges } from '@/components/NavBadge'

interface Message {
  id: number
  content: string
  read: boolean
  createdAt: string
  sender: { id: number; name: string }
}

interface Props {
  otherId: number
  otherName: string
  /** Called once the other person's name is known from the thread. */
  onOtherName?: (name: string) => void
}

/** Within this many pixels of the bottom counts as "reading the latest". */
const NEAR_BOTTOM_PX = 80

export default function MessageThread({ otherId, otherName, onOtherName }: Props) {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  // The earliest message that was unread when the thread opened (null: none).
  // Fixed for the visit, so the "New messages" line doesn't jump as they're read.
  const [firstUnreadId, setFirstUnreadId] = useState<number | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const firstUnreadRef = useRef<HTMLDivElement>(null)
  const loaded = useRef(false)
  const positioned = useRef(false)
  // Whether the next change to the list should scroll to the bottom: only if
  // the reader was already there (or just sent something), so a new message
  // arriving doesn't yank them away from older ones they're reading.
  const followLatest = useRef(true)

  function isNearBottom() {
    const el = scrollRef.current
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_PX
  }

  function fetchMessages() {
    if (!token) return
    fetch(`/api/messages/${otherId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d: Message[]) => {
        if (!Array.isArray(d)) return
        // The thread arrives with its read flags as they were before this
        // request, which then marks the incoming ones read.
        const hasUnread = d.some((m) => m.sender.id === otherId && !m.read)
        if (!loaded.current) {
          loaded.current = true
          setFirstUnreadId(d.find((m) => m.sender.id === otherId && !m.read)?.id ?? null)
          const other = d.find((m) => m.sender.id === otherId)
          if (other) onOtherName?.(other.sender.name)
        }
        if (hasUnread) refreshNavBadges()
        followLatest.current = isNearBottom()
        // Polling returns the same list most of the time; keep the old array
        // then, so nothing re-renders or scrolls.
        setMessages((prev) =>
          prev.length === d.length && prev.at(-1)?.id === d.at(-1)?.id ? prev : d,
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 8000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, otherId])

  // Before paint: open at the first unread message (or the latest), then
  // follow new messages only while the reader is at the bottom.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || messages.length === 0) return
    if (!positioned.current) {
      positioned.current = true
      el.scrollTop = firstUnreadRef.current ? firstUnreadRef.current.offsetTop - 16 : el.scrollHeight
      return
    }
    if (followLatest.current) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, loading])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !token) return
    setSending(true)
    setSendError('')
    try {
      const res = await fetch(`/api/messages/${otherId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim() }),
      })
      const d = await res.json()
      if (res.ok) {
        followLatest.current = true
        setMessages((prev) => [...prev, d])
        setText('')
      }
      else setSendError(d.error ?? 'Message not sent')
    } catch { setSendError('Message not sent') }
    finally { setSending(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-500">
      <Loader2 size={24} className="animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white">
        <p className="font-semibold text-soil text-sm">{otherName}</p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="relative flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender.id === user?.id
            return (
              <div key={m.id}>
                {m.id === firstUnreadId && (
                  <div ref={firstUnreadRef} className="flex items-center gap-2 text-xs font-medium text-red-600 pb-3">
                    <span className="flex-1 h-px bg-red-200" />
                    New messages
                    <span className="flex-1 h-px bg-red-200" />
                  </div>
                )}
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-card px-4 py-2 text-sm ${
                    isMe
                      ? 'bg-paddy text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}>
                    <p>{m.content}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-shoot' : 'text-gray-500'}`}>
                      {new Date(m.createdAt).toLocaleTimeString('en-PH', { timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {sendError && (
        <p className="px-4 pt-2 text-xs text-red-600 bg-white border-t border-gray-200">{sendError}</p>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-200 bg-white flex gap-2">
        <input aria-label="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  )
}
