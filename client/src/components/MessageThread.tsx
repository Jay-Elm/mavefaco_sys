'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import Link from 'next/link'
import Image from 'next/image'
import { Download, ImagePlus, Loader2, Package, Send, X } from 'lucide-react'
import { saveImage } from '@/components/PayHelpers'
import { refreshNavBadges } from '@/components/NavBadge'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'

interface Message {
  id: number
  content: string
  read: boolean
  createdAt: string
  sender: { id: number; name: string }
  /** "order_update" = sent automatically when the order changed. */
  kind?: string
  orderId?: number | null
  /** A photo sent with the message (short-lived link); `content` is then its caption. */
  imageUrl?: string | null
}

const PHOTO_MAX_BYTES = 4 * 1024 * 1024

interface Props {
  otherId: number
  otherName: string
  /** Called once the other person's name is known from the thread. */
  onOtherName?: (name: string) => void
}

/** "Today", "Yesterday", or the full date, for the line between days. */
function dayLabel(d: Date): string {
  const key = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (key(d) === key(today)) return 'Today'
  if (key(d) === key(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' })
}
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

/** Within this many pixels of the bottom counts as "reading the latest". */
const NEAR_BOTTOM_PX = 80

export default function MessageThread({ otherId, otherName, onOtherName }: Props) {
  const { token, user } = useAuth()
  // Goes up when the other side writes, so their message shows at once.
  const live = useLiveVersion()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  // A photo picked to send (with the typed text as its caption), and the one open full screen.
  const [photo, setPhoto] = useState<{ file: File; preview: string } | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
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
  }, [token, otherId, live])

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

  function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > PHOTO_MAX_BYTES) { setSendError('Photo too large (max 4 MB)'); return }
    setSendError('')
    if (photo) URL.revokeObjectURL(photo.preview)
    setPhoto({ file, preview: URL.createObjectURL(file) })
  }

  function dropPhoto() {
    if (photo) URL.revokeObjectURL(photo.preview)
    setPhoto(null)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if ((!text.trim() && !photo) || !token) return
    setSending(true)
    setSendError('')
    try {
      let res: Response
      if (photo) {
        const body = new FormData()
        body.append('file', photo.file)
        body.append('caption', text.trim())
        res = await fetch(`/api/messages/${otherId}/image`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body })
      } else {
        res = await fetch(`/api/messages/${otherId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ content: text.trim() }),
        })
      }
      const d = await res.json()
      if (res.ok) {
        followLatest.current = true
        setMessages((prev) => [...prev, d])
        setText('')
        dropPhoto()
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
          messages.map((m, i) => {
            const isMe = m.sender.id === user?.id
            const newDay = i === 0 || dayKey(messages[i - 1].createdAt) !== dayKey(m.createdAt)
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="flex justify-center pt-1 pb-2">
                    <span className="text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-full px-3 py-0.5">
                      {dayLabel(new Date(m.createdAt))}
                    </span>
                  </div>
                )}
                {m.id === firstUnreadId && (
                  <div ref={firstUnreadRef} className="flex items-center gap-2 text-xs font-medium text-red-600 pb-3">
                    <span className="flex-1 h-px bg-red-200" />
                    New messages
                    <span className="flex-1 h-px bg-red-200" />
                  </div>
                )}
                {m.kind === 'order_update' ? (
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className="max-w-[85%] sm:max-w-[75%] rounded-card border border-paddy/30 bg-field px-4 py-2.5 text-sm text-soil">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-paddy-deep">
                        <Package size={13} aria-hidden="true" /> Order update
                      </p>
                      <p className="mt-1 whitespace-pre-line">{m.content}</p>
                      <p className="mt-1.5 flex items-center justify-between gap-3 text-xs text-gray-500">
                        <Link
                          href={user?.role === 'farmer' ? '/farmer/orders' : '/customer/orders'}
                          className="font-medium text-paddy hover:underline"
                        >
                          View order
                        </Link>
                        <time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleTimeString('en-PH', { timeStyle: 'short' })}</time>
                      </p>
                    </div>
                  </div>
                ) : (
                <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-card px-4 py-2 text-sm ${
                    isMe
                      ? 'bg-paddy text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                  }`}>
                    {m.imageUrl && (
                      <button type="button" onClick={() => setViewing(m.imageUrl!)} aria-label="Open photo" className="block -mx-2 mb-1">
                        <Image
                          src={m.imageUrl}
                          alt={m.content ? `Photo: ${m.content}` : 'Photo'}
                          width={0}
                          height={0}
                          sizes="260px"
                          unoptimized
                          className="w-[260px] max-w-full h-auto max-h-80 object-contain rounded-md bg-white"
                        />
                      </button>
                    )}
                    {(m.content || !m.imageUrl) && <p className="whitespace-pre-line">{m.content || (m.imageUrl === null ? 'Photo (no longer available)' : '')}</p>}
                    <p className={`text-xs mt-1 ${isMe ? 'text-shoot' : 'text-gray-500'}`}>
                      <time dateTime={m.createdAt} title={new Date(m.createdAt).toLocaleString('en-PH', { dateStyle: 'full', timeStyle: 'short' })}>
                        {new Date(m.createdAt).toLocaleTimeString('en-PH', { timeStyle: 'short' })}
                      </time>
                    </p>
                  </div>
                </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {sendError && (
        <p className="px-4 pt-2 text-xs text-red-600 bg-white border-t border-gray-200">{sendError}</p>
      )}

      {photo && (
        <div className="px-4 pt-3 border-t border-gray-200 bg-white flex items-center gap-3">
          <div className="relative w-14 h-14 rounded-md overflow-hidden border border-gray-200 bg-gray-50 shrink-0">
            <Image src={photo.preview} alt="Photo to send" fill unoptimized className="object-cover" />
          </div>
          <p className="flex-1 min-w-0 text-xs text-gray-600 truncate">Photo ready to send.</p>
          <button type="button" onClick={dropPhoto} aria-label="Remove the photo" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><X size={16} /></button>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className={`px-4 py-3 bg-white flex gap-2 ${photo ? '' : 'border-t border-gray-200'}`}>
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={pickPhoto} className="hidden" />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={sending}
          aria-label="Attach a photo"
          title="Attach a photo (e.g. a GCash QR code)"
          className="inline-flex items-center justify-center w-10 rounded-lg border border-gray-300 text-gray-600 hover:text-paddy hover:border-paddy disabled:opacity-50"
        >
          <ImagePlus size={17} />
        </button>
        <input aria-label="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={photo ? 'Add a caption (optional)…' : 'Type a message…'}
          className="flex-1 min-w-0 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
        />
        <button
          type="submit"
          disabled={sending || (!text.trim() && !photo)}
          className="inline-flex items-center gap-1.5 bg-paddy hover:bg-paddy-deep disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-[3000] flex flex-col items-center justify-center gap-4 bg-black/85 p-4"
          onClick={() => setViewing(null)}
        >
          <div className="relative w-full max-w-2xl h-[75vh]" onClick={(e) => e.stopPropagation()}>
            <Image src={viewing} alt="Photo" fill unoptimized className="object-contain" />
          </div>
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => saveImage(viewing, 'photo.jpg')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-soil">
              <Download size={14} /> Save photo
            </button>
            <button type="button" onClick={() => setViewing(null)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-4 py-2 text-sm font-medium text-white">
              <X size={14} /> Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
