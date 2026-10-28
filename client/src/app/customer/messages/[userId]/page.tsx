'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import MessageThread from '@/components/MessageThread'

export default function CustomerConversationPage() {
  const params = useParams()
  const otherId = Number(params.userId)
  const [otherName, setOtherName] = useState('Farmer')

  return (
    // Fills the screen below the 4rem navbar, so only the message list scrolls.
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center gap-3 mb-4">
        <Link href="/customer/messages" className="text-gray-500 hover:text-gray-600">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-semibold text-soil">{otherName}</h1>
      </div>
      <div className="flex-1 min-h-0 border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <MessageThread otherId={otherId} otherName={otherName} onOtherName={setOtherName} />
      </div>
    </div>
  )
}
