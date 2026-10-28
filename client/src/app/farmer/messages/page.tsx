'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, MessageCircle, User, Bell } from 'lucide-react'

interface Conversation {
  user: { id: number; name: string; role: string }
  lastMessage: string
  lastAt: string
  unread: number
}

interface Notice { id: number; title: string; read: boolean; createdAt: string }

export default function FarmerMessagesPage() {
  const { token } = useAuth()
  const [convs, setConvs] = useState<Conversation[]>([])
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) return
    Promise.all([
      fetch('/api/messages', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/notices', { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    ])
      .then(([c, n]) => {
        if (Array.isArray(c)) setConvs(c)
        if (Array.isArray(n)) setNotices(n)
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle size={22} className="text-paddy" />
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
      </div>

      {/* System notices (e.g. a suspended listing): read-only, no reply */}
      {notices.length > 0 && (
        <Link
          href="/farmer/messages/notices"
          className="mb-4 flex items-center gap-4 px-5 py-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
            <Bell size={18} className="text-red-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-gray-900 text-sm">MaVeFaCo notices</p>
              {notices.some((n) => !n.read) && (
                <span className="ml-auto bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {notices.filter((n) => !n.read).length}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{notices[0].title}</p>
          </div>
          <p className="text-xs text-gray-400 shrink-0">
            {new Date(notices[0].createdAt).toLocaleDateString('en-PH', { dateStyle: 'short' })}
          </p>
        </Link>
      )}

      {convs.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <MessageCircle size={40} className="mx-auto mb-3" />
          <p>No messages yet. Customers can message you from your seller page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {convs.map((c) => (
            <Link
              key={c.user.id}
              href={`/farmer/messages/${c.user.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-field flex items-center justify-center shrink-0">
                <User size={18} className="text-paddy" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900 text-sm">{c.user.name}</p>
                  <span className="text-xs text-gray-400 capitalize">{c.user.role}</span>
                  {c.unread > 0 && (
                    <span className="ml-auto bg-paddy text-white text-xs font-bold px-2 py-0.5 rounded-full">
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
