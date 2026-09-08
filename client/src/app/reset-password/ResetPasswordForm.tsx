'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { KeyRound, CheckCircle } from 'lucide-react'
import { z } from 'zod'

// Only the password field is a form input here — the token comes from the
// URL, not something the user types, so it's validated separately below.
const newPasswordSchema = z.object({
  newPassword: z.string().min(12, 'Password must be at least 12 characters'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

type ResetForm = z.infer<typeof newPasswordSchema>

export default function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [success, setSuccess] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetForm>({ resolver: zodResolver(newPasswordSchema) })

  async function onSubmit(data: ResetForm) {
    setServerError('')
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: data.newPassword }),
      })
      const json = await res.json()
      if (!res.ok) {
        setServerError(json.error ?? 'Failed to reset password')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/login'), 2000)
    } catch {
      setServerError('Network error. Please try again.')
    }
  }

  if (!token) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center space-y-3">
        <p className="text-sm text-red-600">This reset link is missing its token.</p>
        <Link href="/forgot-password" className="text-sm text-green-700 font-medium hover:underline">
          Request a new link
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center space-y-3">
        <CheckCircle size={32} className="mx-auto text-green-600" />
        <p className="text-sm text-gray-700">Password reset successfully. Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
      {serverError && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">
          New password
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          {...register('newPassword')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="••••••••••••"
        />
        {errors.newPassword && (
          <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Confirm new password
        </label>
        <input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          {...register('confirmPassword')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="••••••••••••"
        />
        {errors.confirmPassword && (
          <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
      >
        <KeyRound size={16} />
        {isSubmitting ? 'Resetting…' : 'Reset password'}
      </button>
    </form>
  )
}
