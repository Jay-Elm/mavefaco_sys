'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, CheckCircle, User, KeyRound, Mail, AlertTriangle } from 'lucide-react'

export default function CustomerProfilePage() {
  const { isAuthenticated, loading, token, user, login, logout } = useAuth()
  const router = useRouter()

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [newEmail, setNewEmail] = useState('')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwSubmitting, setPwSubmitting] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) { router.replace('/login'); return }
    setName(user?.name ?? '')
    setNewEmail(user?.email ?? '')
  }, [loading, isAuthenticated, user, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError('')
    setSuccess(false)
    setSubmitting(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to update name'); return }
      login({ ...user!, name: data.name })
      setSuccess(true)
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleEmailChange(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setEmailError('')
    setEmailSuccess(false)
    setEmailSubmitting(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail.trim().toLowerCase(), currentPassword: emailPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setEmailError(data.error ?? 'Failed to update email'); return }
      setEmailSuccess(true)
      setEmailPassword('')
      // Changing the email invalidates the current session token server-side —
      // sign the user out locally and send them back to log in with it.
      setTimeout(() => {
        logout()
        router.push('/login')
      }, 1500)
    } catch {
      setEmailError('Request failed')
    } finally {
      setEmailSubmitting(false)
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPassword !== confirmPassword) { setPwError('New passwords do not match'); return }
    if (!token) return
    setPwSubmitting(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setPwError(data.error ?? 'Failed to change password'); return }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwSuccess(true)
      // Changing the password invalidates the current session token server-side —
      // sign the user out locally and send them back to log in with the new one.
      setTimeout(() => {
        logout()
        router.push('/login')
      }, 1500)
    } catch {
      setPwError('Request failed')
    } finally {
      setPwSubmitting(false)
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!confirm('Permanently delete your account?\n\nThis removes your profile, orders, and order history. This cannot be undone.')) return
    setDeleteError('')
    setDeleting(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: deletePassword }),
      })
      const data = await res.json()
      if (!res.ok) { setDeleteError(data.error ?? 'Failed to delete account'); return }
      logout()
      router.push('/')
    } catch {
      setDeleteError('Request failed')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <User size={22} className="text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500">Update your account information</p>
        </div>
      </div>

      {/* Name */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle size={16} />
          Name updated successfully
        </div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              value="Customer"
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Saving…' : 'Save Name'}
            </button>
          </div>
        </form>
      </div>

      {/* Change email */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <Mail size={18} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Change Email</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Currently: <span className="font-medium text-gray-700">{user?.email}</span>. Changing your email requires your current password and will sign you out.
        </p>

        {emailError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {emailError}
          </div>
        )}
        {emailSuccess && (
          <div className="mb-4 flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle size={16} />
            Email changed — signing you out…
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handleEmailChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={emailSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
              >
                {emailSubmitting && <Loader2 size={14} className="animate-spin" />}
                {emailSubmitting ? 'Saving…' : 'Change Email'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Change password */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <KeyRound size={18} className="text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        </div>

        {pwError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="mb-4 flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <CheckCircle size={16} />
            Password changed successfully
          </div>
        )}

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                minLength={12}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div className="pt-2">
              <button
                type="submit"
                disabled={pwSubmitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
              >
                {pwSubmitting && <Loader2 size={14} className="animate-spin" />}
                {pwSubmitting ? 'Updating…' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Danger zone */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="text-lg font-semibold text-red-700">Delete Account</h2>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Permanently deletes your account and order history. You can&apos;t undo this, and it&apos;s blocked while you have any active (pending/confirmed/shipped) orders.
        </p>

        {deleteError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {deleteError}
          </div>
        )}

        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-6">
          <form onSubmit={handleDeleteAccount} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={deletePassword}
                onChange={e => setDeletePassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="pt-1">
              <button
                type="submit"
                disabled={deleting}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? 'Deleting…' : 'Delete My Account'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
