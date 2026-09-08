'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { LogIn, Leaf, Mail } from 'lucide-react'
import { loginSchema, type LoginInput as LoginForm } from '@/validators/auth'

function roleDest(role?: string) {
  if (role === 'admin' || role === 'manager') return '/dashboard'
  if (role === 'farmer') return '/farmer'
  return '/products'
}

export default function LoginPage() {
  const { login, isAuthenticated, loading, user } = useAuth()
  const router = useRouter()
  const [serverError, setServerError] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace(roleDest(user?.role))
  }, [loading, isAuthenticated, user, router])

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(data: LoginForm) {
    setServerError('')
    setNeedsVerification(false)
    setResent(false)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()

      if (!res.ok) {
        setServerError(json.error ?? 'Login failed')
        if (json.code === 'EMAIL_NOT_VERIFIED') setNeedsVerification(true)
        return
      }

      login(json.user)
      // useEffect handles redirect once isAuthenticated updates
    } catch {
      setServerError('Network error. Please try again.')
    }
  }

  async function handleResend() {
    setResending(true)
    try {
      await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: getValues('email') }),
      })
      // The API response is deliberately generic (anti-enumeration) — show
      // the same "sent" state regardless of what actually happened server-side.
      setResent(true)
    } catch {
      // Silent — the button stays available to retry.
    } finally {
      setResending(false)
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
          <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 text-sm mt-1">Sign in to your CoopMarket account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          {serverError && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200 space-y-2">
              <p>{serverError}</p>
              {needsVerification && (
                resent ? (
                  <p className="text-green-700 flex items-center gap-1">
                    <Mail size={14} /> New verification link sent — check your email.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resending}
                    className="text-red-800 font-medium underline disabled:opacity-60"
                  >
                    {resending ? 'Sending…' : 'Resend verification email'}
                  </button>
                )
              )}
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

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-green-700 hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
          >
            <LogIn size={16} />
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-green-700 font-medium hover:underline">
            Register
          </Link>
        </p>
      </div>
    </div>
  )
}
