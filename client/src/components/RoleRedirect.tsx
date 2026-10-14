'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

const HOME: Record<string, string> = {
  admin: '/dashboard',
  manager: '/dashboard',
  farmer: '/farmer',
  customer: '/products',
}

/** Sends a signed-in user whose role is in `roles` to their own home page. */
export default function RoleRedirect({ roles }: { roles: string[] }) {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading || !isAuthenticated || !user) return
    if (roles.includes(user.role)) router.replace(HOME[user.role] ?? '/')
  }, [loading, isAuthenticated, user, roles, router])

  return null
}
