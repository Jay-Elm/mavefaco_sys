'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { MessageCircle, Bell } from 'lucide-react'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import ConversationList, { when } from '@/components/ConversationList'

interface Notice { id: number; title: string; read: boolean; createdAt: string }

export default function FarmerMessagesPage() {
  const { token } = useAuth()
  const live = useLiveVersion()
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => {
    if (!token) return
    fetch('/api/notices', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((n) => { if (Array.isArray(n)) setNotices(n) })
  }, [token, live])

  const unreadNotices = notices.filter((n) => !n.read).length

  return (
    <div className="p-4 sm:p-8 max-w-4xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <MessageCircle size={22} className="text-paddy" />
        <h1 className="text-2xl font-bold text-soil">Messages</h1>
      </div>

      <ConversationList
        basePath="/farmer/messages"
        empty={<p>No messages yet. Customers can message you from your seller page.</p>}
        above={
          // System notices (e.g. a suspended listing): always first, can't be deleted
          notices.length > 0 && (
            <Link
              href="/farmer/messages/notices"
              className="mb-4 flex items-center gap-4 px-5 py-4 bg-white rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center shrink-0">
                <Bell size={18} className="text-red-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-soil text-sm">MaVeFaCo notices</p>
                  {unreadNotices > 0 && (
                    <span className="ml-auto bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{unreadNotices}</span>
                  )}
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">{notices[0].title}</p>
              </div>
              <p className="text-xs text-gray-500 shrink-0">{when(notices[0].createdAt)}</p>
            </Link>
          )
        }
      />
    </div>
  )
}
