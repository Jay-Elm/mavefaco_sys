'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

type Status = 'verifying' | 'success' | 'error'

export default function VerifyEmailStatus() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<Status>('verifying')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('error')
      setMessage('This verification link is missing its token.')
      return
    }
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setStatus('error')
          setMessage(data.error ?? 'Failed to verify email')
          return
        }
        setStatus('success')
        setMessage(data.message)
      })
      .catch(() => {
        setStatus('error')
        setMessage('Network error. Please try again.')
      })
    // Only run once per mount — the token doesn't change, and re-running
    // this on every render would burn through the single-use token.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center space-y-3">
      {status === 'verifying' && (
        <>
          <Loader2 size={32} className="mx-auto text-green-600 animate-spin" />
          <p className="text-sm text-gray-600">Verifying your email…</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle size={32} className="mx-auto text-green-600" />
          <p className="text-sm text-gray-700">{message}</p>
          <Link href="/login" className="inline-block text-sm text-green-700 font-medium hover:underline">
            Sign in
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle size={32} className="mx-auto text-red-500" />
          <p className="text-sm text-red-600">{message}</p>
          <Link href="/login" className="inline-block text-sm text-green-700 font-medium hover:underline">
            Back to sign in
          </Link>
        </>
      )}
    </div>
  )
}
