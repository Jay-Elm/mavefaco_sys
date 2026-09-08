'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, CheckCircle, ShieldCheck, ShieldAlert, X, KeyRound, Mail, AlertTriangle } from 'lucide-react'

interface ProfileData {
  hasIdImage: boolean
  verified: boolean
}

export default function FarmerProfilePage() {
  const { token, user, login, logout } = useAuth()
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

  const [profileData, setProfileData] = useState<ProfileData>({ hasIdImage: false, verified: false })
  const idFileRef = useRef<HTMLInputElement>(null)
  const [savingId, setSavingId] = useState(false)
  const [idSuccess, setIdSuccess] = useState(false)
  const [idError, setIdError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.hasIdImage !== undefined) {
          setProfileData({ hasIdImage: data.hasIdImage, verified: data.verified })
        }
      })
  }, [token])

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

  async function handleUploadId(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !token) return
    setIdError('')
    setIdSuccess(false)
    setSavingId(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/users/me/id-image', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body,
      })
      const data = await res.json()
      if (!res.ok) { setIdError(data.error ?? 'Upload failed'); return }
      setProfileData({ hasIdImage: true, verified: false })
      setIdSuccess(true)
    } catch {
      setIdError('Request failed')
    } finally {
      setSavingId(false)
      if (idFileRef.current) idFileRef.current.value = ''
    }
  }

  async function handleRemoveId() {
    if (!token) return
    if (!confirm('Remove your submitted ID? You will need to upload a new one to be verified again.')) return
    setIdError('')
    setIdSuccess(false)
    setSavingId(true)
    try {
      const res = await fetch('/api/users/me/id-image', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setIdError(data.error ?? 'Failed to remove'); return }
      setProfileData({ hasIdImage: false, verified: false })
    } catch {
      setIdError('Request failed')
    } finally {
      setSavingId(false)
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
    if (!confirm('Permanently delete your account?\n\nThis removes your profile, products, and order history. This cannot be undone.')) return
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
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

        {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
        {success && (
          <div className="mb-4 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} />
            Name updated successfully
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input
              value={user?.role ?? ''} disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 capitalize"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit" disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
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
          <h2 className="text-lg font-semibold text-gray-900">Change Email</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Currently: <span className="font-medium text-gray-700">{user?.email}</span>. Changing your email requires your current password and will sign you out.
        </p>

        {emailError && <div className="mb-3 text-red-600 text-sm">{emailError}</div>}
        {emailSuccess && (
          <div className="mb-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} /> Email changed — signing you out…
          </div>
        )}

        <form onSubmit={handleEmailChange} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="pt-1">
            <button
              type="submit" disabled={emailSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
            >
              {emailSubmitting && <Loader2 size={14} className="animate-spin" />}
              {emailSubmitting ? 'Saving…' : 'Change Email'}
            </button>
          </div>
        </form>
      </div>

      {/* ID Verification */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-gray-900">ID Verification</h2>
          {profileData.verified ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
              <ShieldCheck size={12} /> Verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
              <ShieldAlert size={12} /> {profileData.hasIdImage ? 'Pending review' : 'Not submitted'}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Upload a photo of your valid government-issued ID. It&apos;s stored privately — only an admin reviewing your account can view it. An admin will review and verify your account.
        </p>

        {idError && <div className="mb-3 text-red-600 text-sm">{idError}</div>}
        {idSuccess && (
          <div className="mb-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} /> ID submitted for review
          </div>
        )}

        {profileData.hasIdImage && (
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            <span className="flex-1">ID on file, awaiting admin review</span>
          </div>
        )}

        <input
          ref={idFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUploadId}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => idFileRef.current?.click()}
            disabled={savingId}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
          >
            {savingId && <Loader2 size={14} className="animate-spin" />}
            {savingId ? 'Uploading…' : profileData.hasIdImage ? 'Replace ID photo' : 'Upload ID photo'}
          </button>
          {profileData.hasIdImage && !savingId && (
            <button
              type="button"
              onClick={handleRemoveId}
              className="text-sm text-red-500 hover:text-red-700 flex items-center gap-1 transition-colors"
            >
              <X size={13} /> Remove
            </button>
          )}
        </div>
      </div>

      {/* Change Password */}
      <div className="border-t border-gray-200 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound size={18} className="text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Leave blank if you don&apos;t want to change your password.
        </p>

        {pwError && <div className="mb-3 text-red-600 text-sm">{pwError}</div>}
        {pwSuccess && (
          <div className="mb-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} /> Password changed successfully
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
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
          Permanently deletes your account, products, and order history. You can&apos;t undo this, and it&apos;s blocked while you have products in active orders.
        </p>

        {deleteError && <div className="mb-3 text-red-600 text-sm">{deleteError}</div>}

        <form onSubmit={handleDeleteAccount} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <input
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
