'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, CheckCircle, ShieldCheck, ShieldAlert, ExternalLink, KeyRound } from 'lucide-react'
import { isSafeUrl } from '@/lib/url'

interface ProfileData {
  idImageUrl: string | null
  verified: boolean
}

export default function FarmerProfilePage() {
  const { token, user, login } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [profileData, setProfileData] = useState<ProfileData>({ idImageUrl: null, verified: false })
  const [idUrl, setIdUrl] = useState('')
  const [savingId, setSavingId] = useState(false)
  const [idSuccess, setIdSuccess] = useState(false)
  const [idError, setIdError] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changingPw, setChangingPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => {
    if (!token) return
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.idImageUrl !== undefined) {
          setProfileData({ idImageUrl: data.idImageUrl, verified: data.verified })
          setIdUrl(data.idImageUrl ?? '')
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
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to update profile'); return }
      login(token, { ...user!, name: data.name, email: data.email })
      setSuccess(true)
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveId(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setIdError('')
    setIdSuccess(false)
    setSavingId(true)
    try {
      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ idImageUrl: idUrl.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setIdError(data.error ?? 'Failed to save'); return }
      setProfileData(prev => ({ ...prev, idImageUrl: data.idImageUrl, verified: false }))
      setIdSuccess(true)
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
    if (newPassword.length < 6) { setPwError('New password must be at least 6 characters'); return }
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
    } catch {
      setPwError('Request failed')
    } finally {
      setChangingPw(false)
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
            Profile updated successfully
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
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
              {submitting ? 'Saving…' : 'Save Changes'}
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
              <ShieldAlert size={12} /> {profileData.idImageUrl ? 'Pending review' : 'Not submitted'}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Submit a URL to your valid government-issued ID. An admin will review and verify your account.
        </p>

        {idError && <div className="mb-3 text-red-600 text-sm">{idError}</div>}
        {idSuccess && (
          <div className="mb-3 flex items-center gap-2 text-green-700 text-sm">
            <CheckCircle size={16} /> ID submitted for review
          </div>
        )}

        {profileData.idImageUrl && (
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
            <span className="truncate flex-1">{profileData.idImageUrl}</span>
            {isSafeUrl(profileData.idImageUrl) && (
              <a href={profileData.idImageUrl} target="_blank" rel="noopener noreferrer"
                className="text-green-700 hover:text-green-900 flex-shrink-0">
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        )}

        <form onSubmit={handleSaveId} className="flex gap-2">
          <input
            type="url"
            value={idUrl}
            onChange={(e) => setIdUrl(e.target.value)}
            placeholder="https://drive.google.com/... or image URL"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            type="submit" disabled={savingId}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60 flex-shrink-0"
          >
            {savingId && <Loader2 size={14} className="animate-spin" />}
            {savingId ? 'Saving…' : 'Submit ID'}
          </button>
        </form>
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
              minLength={6}
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
    </div>
  )
}
