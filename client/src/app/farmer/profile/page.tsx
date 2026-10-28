'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, CheckCircle, KeyRound, Mail, AlertTriangle } from 'lucide-react'
import { useDialog } from '@/contexts/DialogContext'
import IdVerificationSection from '@/components/idVerification/IdVerificationSection'


export default function FarmerProfilePage() {
  const { token, user, login, logout } = useAuth()
  const dialog = useDialog()
  const router = useRouter()
  const [name, setName] = useState(user?.name ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [newEmail, setNewEmail] = useState(user?.email ?? '')
  const [emailPassword, setEmailPassword] = useState('')
  const [emailSubmitting, setEmailSubmitting] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [emailSuccess, setEmailSuccess] = useState(false)


  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

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
      // Nothing changes until the new address confirms via the emailed link,
      // so the session stays valid; the confirmation itself logs out everywhere.
    } catch {
      setEmailError('Request failed')
    } finally {
      setEmailSubmitting(false)
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    setPwSuccess(false)
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return }
    if (newPassword.length < 12) { setPwError('New password must be at least 12 characters'); return }
    if (!token) return
    setChangingPw(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setPwError(data.error ?? 'Failed to change password'); return }
      setPwSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      // Changing the password invalidates the current session token server-side —
      // sign the user out locally and send them back to log in with the new one.
      setTimeout(() => {
        logout()
        router.push('/login')
      }, 1500)
    } catch {
      setPwError('Request failed')
    } finally {
      setChangingPw(false)
    }
  }

  async function handleDeleteAccount(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    if (!(await dialog.confirm({ title: 'Permanently delete your account?', message: "Your name, email, login and messages are removed and your products leave the shop. Past orders stay on record without your details, so customers' order history stays correct.\n\nThis cannot be undone.", confirmLabel: 'Delete account', tone: 'danger' }))) return
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

  return (
    <div className="p-8 max-w-lg space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-soil mb-6">Profile</h1>

        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
        {success && (
          <div className="mb-4 flex items-center gap-2 text-paddy text-sm">
            <CheckCircle size={16} />
            Name updated successfully
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input aria-label="Name"
              value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input aria-label="Role"
              value={user?.role ?? ''} disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 capitalize"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-paddy text-white text-sm font-medium rounded-lg hover:bg-paddy-deep transition-colors disabled:opacity-60"
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              {submitting ? 'Saving…' : 'Save Name'}
            </button>
          </div>
        </form>
      </div>

      {/* Change Email */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <Mail size={18} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-soil">Change Email</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Currently: <span className="font-medium text-gray-700">{user?.email}</span>. Changing your email requires your current password and will sign you out.
        </p>

        {emailError && <div className="mb-3 text-red-600 text-sm">{emailError}</div>}
        {emailSuccess && (
          <div className="mb-3 flex items-center gap-2 text-paddy text-sm">
            <CheckCircle size={16} /> Check {newEmail.trim().toLowerCase()} for a confirmation link. Your email won&apos;t change until you click it.
          </div>
        )}

        <form onSubmit={handleEmailChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
            <input aria-label="New Email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input aria-label="Current Password"
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
          </div>
          <div className="pt-1">
            <button
              type="submit" disabled={emailSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-paddy text-white text-sm font-medium rounded-lg hover:bg-paddy-deep transition-colors disabled:opacity-60"
            >
              {emailSubmitting && <Loader2 size={14} className="animate-spin" />}
              {emailSubmitting ? 'Saving…' : 'Change Email'}
            </button>
          </div>
        </form>
      </div>

      {/* ID Verification */}
      <div className="border-t border-gray-200 pt-8">
        {token && <IdVerificationSection token={token} />}
      </div>

      {/* Change Password */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-soil">Change Password</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Leave blank if you don&apos;t want to change your password.
        </p>

        {pwError && <div className="mb-3 text-red-600 text-sm">{pwError}</div>}
        {pwSuccess && (
          <div className="mb-3 flex items-center gap-2 text-paddy text-sm">
            <CheckCircle size={16} /> Password changed successfully
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input aria-label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input aria-label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={12}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <input aria-label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={changingPw || !currentPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 px-5 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-60"
            >
              {changingPw && <Loader2 size={14} className="animate-spin" />}
              {changingPw ? 'Changing…' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Danger zone */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle size={18} className="text-red-500" />
          <h2 className="text-lg font-semibold text-red-700">Delete Account</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Permanently deletes your account: your name, email, login and messages are removed and your products leave the shop, while past orders are kept without your details. You can&apos;t undo this, and it&apos;s blocked while you have products in active orders.
        </p>

        {deleteError && <div className="mb-3 text-red-600 text-sm">{deleteError}</div>}

        <form onSubmit={handleDeleteAccount} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input aria-label="Current Password"
              type="password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={deleting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
            >
              {deleting && <Loader2 size={14} className="animate-spin" />}
              {deleting ? 'Deleting…' : 'Delete My Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
