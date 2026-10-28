'use client'

import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

/** Seller-page "Message Farmer" button: only customers (and guests) can message farmers. */
export default function MessageFarmerLink({ farmerId }: { farmerId: number }) {
  const { user, isAuthenticated } = useAuth()
  if (isAuthenticated && user?.role !== 'customer') return null

  return (
    <Link
      href={isAuthenticated ? `/customer/messages/${farmerId}` : '/login'}
      className="ml-auto shrink-0 inline-flex items-center gap-2 bg-paddy hover:bg-paddy-deep text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
    >
      <MessageCircle size={15} /> Message Farmer
    </Link>
  )
}
