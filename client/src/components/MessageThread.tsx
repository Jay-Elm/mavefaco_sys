'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Send } from 'lucide-react'

interface Message {
  id: number
  content: string
  createdAt: string
  sender: { id: number; name: string }
}

interface Props {
  otherId: number
  otherName: string
}

export default function MessageThread({ otherId, otherName }: Props) {
  const { token, user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  function fetchMessages() {
    if (!token) return
    fetch(`/api/messages/${otherId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setMessages(d) })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 8000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, otherId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !token) return
    setSending(true)
    try {
      const res = await fetch(`/api/messages/${otherId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text.trim() }),
      })
      const d = await res.json()
      if (res.ok) { setMessages((prev) => [...prev, d]); setText('') }
    } catch {}
    finally { setSending(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={24} className="animate-spin" />
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3 border-b border-gray-200 bg-white">
        <p className="font-semibold text-gray-900 text-sm">{otherName}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hello!</p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender.id === user?.id
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  isMe
                    ? 'bg-green-700 text-white rounded-br-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                }`}>
                  <p>{m.content}</p>
                  <p className={`text-xs mt-1 ${isMe ? 'text-green-200' : 'text-gray-400'}`}>
                    {new Date(m.createdAt).toLocaleTimeString('en-PH', { timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="px-4 py-3 border-t border-gray-200 bg-white flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border border-gray-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="inline-flex items-center gap-1.5 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </form>
    </div>
  )
}
