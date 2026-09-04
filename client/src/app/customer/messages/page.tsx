'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, MessageCircle, User } from 'lucide-react'

interface Conversation {
  user: { id: number; name: string; role: string }
  lastMessage: string
  lastAt: string
  unread: number
}

export default function CustomerMessagesPage() {
  const { token, isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()
  const [convs, setConvs] = useState<Conversation[]>([])
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) { router.replace('/login'); return }
    fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setConvs(d) })
      .finally(() => setFetching(false))
  }, [authLoading, isAuthenticated, token, router])

  if (authLoading || fetching) return (
    <div className="flex items-center justify-center py-20 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle size={22} className="text-green-600" />
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>

      {convs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageCircle size={40} className="mx-auto mb-3" />
          <p>No messages yet.</p>
          <Link href="/products" className="mt-3 inline-block text-green-700 text-sm font-medium hover:underline">
            Browse products and contact a farmer →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {convs.map((c) => (
            <Link
              key={c.user.id}
              href={`/customer/messages/${c.user.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <User size={18} className="text-green-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{c.user.name}</p>
                  <span className="text-xs text-gray-400 capitalize">{c.user.role}</span>
                  {c.unread > 0 && (
                    <span className="ml-auto bg-green-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{c.lastMessage}</p>
              </div>
              <p className="text-xs text-gray-400 shrink-0">
                {new Date(c.lastAt).toLocaleDateString('en-PH', { dateStyle: 'short' })}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
