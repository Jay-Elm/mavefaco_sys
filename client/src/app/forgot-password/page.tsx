'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { Mail, Leaf, ArrowLeft, CheckCircle } from 'lucide-react'
import { forgotPasswordSchema, type ForgotPasswordInput as ForgotPasswordForm } from '@/validators/auth'

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(forgotPasswordSchema) })

  async function onSubmit(data: ForgotPasswordForm) {
    setServerError('')
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      // The API always responds the same way whether or not the email is
      // registered — that's deliberate (avoids leaking which emails have
      // accounts), so the client just shows the generic message on any
      // non-network response.
      if (res.ok || res.status === 429) {
        const json = await res.json().catch(() => null)
        if (res.status === 429) {
          setServerError(json?.error ?? 'Too many requests. Please try again later.')
          return
        }
      }
      setSubmitted(true)
    } catch {
      setServerError('Network error. Please try again.')
    }
  }

  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-green-100 p-3 rounded-full">
              <Leaf size={28} className="text-green-700" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset your password</h1>
          <p className="text-gray-500 text-sm mt-1">We&apos;ll email you a link to choose a new one</p>
        </div>

        {submitted ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 text-center space-y-3">
            <CheckCircle size={32} className="mx-auto text-green-600" />
            <p className="text-sm text-gray-700">
              If an account exists for that email, we&apos;ve sent a password reset link. Check your inbox (and spam folder).
            </p>
            <Link href="/login" className="inline-flex items-center gap-1 text-sm text-green-700 font-medium hover:underline">
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
            {serverError && (
              <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">
                {serverError}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                {...register('email')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="you@example.com"
              />
              {errors.email && (
                <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
            >
              <Mail size={16} />
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-gray-500 mt-4">
          <Link href="/login" className="text-green-700 font-medium hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
