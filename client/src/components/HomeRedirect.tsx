'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function HomeRedirect() {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading || !isAuthenticated) return
    if (user?.role === 'admin' || user?.role === 'manager') router.replace('/dashboard')
    else if (user?.role === 'farmer') router.replace('/farmer')
  }, [loading, isAuthenticated, user, router])

  return null
}
