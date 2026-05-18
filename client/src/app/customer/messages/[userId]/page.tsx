'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ArrowLeft } from 'lucide-react'
import MessageThread from '@/components/MessageThread'

export default function CustomerConversationPage() {
  const { token } = useAuth()
  const params = useParams()
  const otherId = Number(params.userId)
  const [otherName, setOtherName] = useState('Farmer')

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
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col" style={{ height: 'calc(100vh - 56px)' }}>
      <div className="flex items-center gap-3 mb-4">
        <Link href="/customer/messages" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-gray-900">{otherName}</h1>
      </div>
      <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <MessageThread otherId={otherId} otherName={otherName} />
      </div>
    </div>
  )
}
