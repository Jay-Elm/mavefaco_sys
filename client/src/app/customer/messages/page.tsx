'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, MessageCircle } from 'lucide-react'
import ConversationList from '@/components/ConversationList'

export default function CustomerMessagesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.replace('/login')
  }, [authLoading, isAuthenticated, router])

  if (authLoading || !isAuthenticated) return (
    <div className="flex items-center justify-center py-20 text-gray-500">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-6">
        <MessageCircle size={22} className="text-paddy" />
        <h1 className="font-display text-4xl font-bold text-soil">Messages</h1>
      </div>
      <ConversationList
        basePath="/customer/messages"
        empty={
          <>
            <p>No messages yet.</p>
            <Link href="/products" className="mt-3 inline-block text-paddy text-sm font-medium hover:underline">
              Browse products and contact a farmer →
            </Link>
          </>
        }
      />
    </div>
  )
}
