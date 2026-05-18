'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft } from 'lucide-react'
import MessageThread from '@/components/MessageThread'

export default function FarmerConversationPage() {
  const { token } = useAuth()
  const params = useParams()
  const otherId = Number(params.userId)
  const [otherName, setOtherName] = useState('Customer')

  useEffect(() => {
    if (!token || isNaN(otherId)) return
    fetch(`/api/messages/${otherId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((msgs: { sender: { id: number; name: string } }[]) => {
        const other = msgs.find((m) => m.sender.id === otherId)
        if (other) setOtherName(other.sender.name)
      })
  }, [token, otherId])

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-4 border-b border-gray-200 flex items-center gap-3">
        <Link href="/farmer/messages" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-gray-900">Conversation</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <MessageThread otherId={otherId} otherName={otherName} />
      </div>
    </div>
  )
}
