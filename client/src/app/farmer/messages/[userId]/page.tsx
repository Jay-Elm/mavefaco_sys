'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import MessageThread from '@/components/MessageThread'

export default function FarmerConversationPage() {
  const params = useParams()
  const otherId = Number(params.userId)
  const [otherName, setOtherName] = useState('Customer')

  return (
    <div className="flex flex-col h-full">
      <div className="px-8 py-4 border-b border-gray-200 flex items-center gap-3">
        <Link href="/farmer/messages" className="text-gray-400 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-gray-900">Conversation</h1>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <MessageThread otherId={otherId} otherName={otherName} onOtherName={setOtherName} />
      </div>
    </div>
  )
}
