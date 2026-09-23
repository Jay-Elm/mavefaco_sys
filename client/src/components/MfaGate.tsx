'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, ShieldCheck, Copy, Check, AlertTriangle, KeyRound } from 'lucide-react'

interface MfaUser {
  id: number
  name: string
  email: string
  role: string
}

interface Props {
  // 'setup' — this account has never enrolled in 2FA before (mandatory for
  // admin/manager); 'verify' — 2FA is already enabled, just need a code.
  mode: 'setup' | 'verify'
  onComplete: (user: MfaUser) => void
}

/**
 * Rendered by the login page in place of the credentials form once the
 * server reports the password was correct but a second factor is still
 * needed. Neither branch has a real session yet — /api/auth/mfa/* routes
 * authenticate via the short-lived mfa_pending cookie the login route set,
 * not the normal session cookie.
 */
export default function MfaGate({ mode, onComplete }: Props) {
  const [loadingSetup, setLoadingSetup] = useState(mode === 'setup')
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [pendingUser, setPendingUser] = useState<MfaUser | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (mode !== 'setup') return
    fetch('/api/auth/mfa/setup', { method: 'POST' })
      .then((r) => r.json().then((json) => ({ ok: r.ok, json })))
      .then(({ ok, json }) => {
        if (!ok) { setError(json.error ?? 'Failed to start setup'); return }
        setQrCodeDataUrl(json.qrCodeDataUrl)
        setSecret(json.secret)
      })
      .catch(() => setError('Network error. Please try again.'))
      .finally(() => setLoadingSetup(false))
  }, [mode])

  async function handleSubmitCode(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const endpoint = mode === 'setup' ? '/api/auth/mfa/confirm' : '/api/auth/mfa/verify'
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Invalid code'); return }

      if (mode === 'setup' && Array.isArray(json.backupCodes)) {
        setPendingUser(json.user)
        setBackupCodes(json.backupCodes)
        return
      }
      onComplete(json.user)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleCopyBackupCodes() {
    if (!backupCodes) return
    navigator.clipboard?.writeText(backupCodes.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  // Step 3 (setup only): show the one-time backup codes before finishing login.
  if (backupCodes && pendingUser) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2 text-green-700">
          <ShieldCheck size={20} />
          <h2 className="font-bold text-gray-900">Two-factor authentication enabled</h2>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800 flex gap-2">
          <AlertTriangle size={28} className="shrink-0" />
          <p>
            Save these backup codes somewhere safe. Each one can be used once to sign in if you lose access
            to your authenticator app — they won&apos;t be shown again.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 bg-gray-50 border border-gray-200 rounded-lg p-4 font-mono text-sm text-gray-800">
          {backupCodes.map((c) => <span key={c}>{c}</span>)}
        </div>
        <button
          type="button"
          onClick={handleCopyBackupCodes}
          className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg py-2 hover:bg-gray-50 transition-colors"
        >
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
          {copied ? 'Copied' : 'Copy codes'}
        </button>
        <button
          type="button"
          onClick={() => onComplete(pendingUser)}
          className="w-full bg-forest hover:bg-forest-mid text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          I&apos;ve saved these — continue
        </button>
      </div>
    )
  }

  // Step 1 (setup only): scan the QR code.
  if (mode === 'setup' && loadingSetup) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
      <div className="flex items-center gap-2 text-gray-900">
        <KeyRound size={18} className="text-green-700" />
        <h2 className="font-bold">Two-factor authentication</h2>
      </div>

      {mode === 'setup' ? (
        qrCodeDataUrl ? (
          <>
            <p className="text-sm text-gray-600">
              Admin and manager accounts require an authenticator app. Scan this QR code with Google
              Authenticator, Authy, or similar, then enter the 6-digit code it shows.
            </p>
            <div className="flex justify-center">
              <Image src={qrCodeDataUrl} alt="Scan with your authenticator app" width={176} height={176} unoptimized className="border border-gray-200 rounded-lg" />
            </div>
            <p className="text-xs text-gray-400 text-center break-all">
              Can&apos;t scan? Enter this code manually: <span className="font-mono">{secret}</span>
            </p>
          </>
        ) : null
      ) : (
        <p className="text-sm text-gray-600">Enter the 6-digit code from your authenticator app, or a backup code.</p>
      )}

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-200">{error}</div>
      )}

      <form onSubmit={handleSubmitCode} className="space-y-3">
        <input
          type="text"
          inputMode={mode === 'setup' ? 'numeric' : 'text'}
          autoComplete="one-time-code"
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={mode === 'setup' ? '6-digit code' : '6-digit code or backup code'}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={submitting || !code.trim()}
          className="w-full flex items-center justify-center gap-2 bg-forest hover:bg-forest-mid disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors text-sm"
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
          {submitting ? 'Verifying…' : 'Verify'}
        </button>
      </form>
    </div>
  )
}
