'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

type Status = 'confirming' | 'success' | 'error'

export default function ConfirmEmailChangeStatus() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const { logout } = useAuth()

  const [status, setStatus] = useState<Status>(token ? 'confirming' : 'error')
  const [message, setMessage] = useState(token ? '' : 'This confirmation link is missing its token.')

  useEffect(() => {
    if (!token) return
    fetch('/api/auth/confirm-email-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setStatus('error')
          setMessage(data.error ?? 'Failed to confirm the email change')
          return
        }
        // The change logged out every session server-side; drop this
        // browser's signed-in state too so the user signs in again.
        logout()
        setStatus('success')
        setMessage(data.message)
      })
      .catch(() => {
        setStatus('error')
        setMessage('Network error. Please try again.')
      })
    // Only run once per mount — the token is single-use.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center space-y-3">
      {status === 'confirming' && (
        <>
          <Loader2 size={32} className="mx-auto text-forest-mid animate-spin" />
          <p className="text-sm text-gray-600">Confirming your new email address…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle size={32} className="mx-auto text-green-600" />
          <p className="text-sm text-gray-700">{message}</p>
          <Link href="/login" className="inline-block text-sm text-forest font-medium hover:underline">
            Sign in
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle size={32} className="mx-auto text-red-500" />
          <p className="text-sm text-red-600">{message}</p>
          <Link href="/" className="inline-block text-sm text-forest font-medium hover:underline">
            Back to the shop
          </Link>
        </>
      )}
    </div>
  )
}
