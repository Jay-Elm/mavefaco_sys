'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Loader2, Shield, User, Leaf, ShoppingBag,
  Ban, CheckCircle, Trash2, AlertTriangle, ShieldCheck,
  ExternalLink, KeyRound, X,
} from 'lucide-react'

interface UserRow {
  id: number
  name: string
  email: string
  role: string
  suspended: boolean
  idImageUrl: string | null
  verified: boolean
  createdAt: string
  _count: { products: number; orders: number }
}

const ROLE_STYLES: Record<string, string> = {
  admin:    'bg-red-100 text-red-700',
  manager:  'bg-purple-100 text-purple-700',
  farmer:   'bg-green-100 text-green-700',
  customer: 'bg-blue-100 text-blue-700',
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin:    <Shield size={11} />,
  manager:  <Shield size={11} />,
  farmer:   <Leaf size={11} />,
  customer: <ShoppingBag size={11} />,
}

export default function UsersPage() {
  const { token, user: currentUser } = useAuth()
  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [actionId, setActionId]   = useState<number | null>(null)
  const [actionError, setActionError] = useState<{ id: number; msg: string } | null>(null)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [newPw, setNewPw]         = useState('')
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setUsers(data)))
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSuspend(u: UserRow) {
    if (!token) return
    const next = !u.suspended
    if (!confirm(`${next ? 'Suspend' : 'Reactivate'} ${u.name}?`)) return
    setActionId(u.id); setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ suspended: next }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id: u.id, msg: data.error }); return }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, suspended: next } : x)))
    } catch {
      setActionError({ id: u.id, msg: 'Request failed' })
    } finally { setActionId(null) }
  }

  async function handleVerify(u: UserRow) {
    if (!token) return
    setActionId(u.id); setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ verified: !u.verified }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id: u.id, msg: data.error }); return }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, verified: !u.verified } : x)))
    } catch {
      setActionError({ id: u.id, msg: 'Request failed' })
    } finally { setActionId(null) }
  }

  async function handleResetPassword() {
    if (!token || !resetTarget || !newPw.trim()) return
    setActionId(resetTarget.id); setResetError('')
    try {
      const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ newPassword: newPw.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setResetError(data.error ?? 'Failed to reset password'); return }
      const id = resetTarget.id
      setResetTarget(null); setNewPw('')
      setResetSuccess(id)
      setTimeout(() => setResetSuccess(null), 3000)
    } catch {
      setResetError('Request failed')
    } finally { setActionId(null) }
  }

  async function handleDelete(u: UserRow) {
    if (!token) return
    if (!confirm(`Permanently delete "${u.name}"?\n\nThis removes their account, products, and order history. Blocked only if they have active orders.`)) return
    setActionId(u.id); setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id: u.id, msg: data.error }); return }
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
    } catch {
      setActionError({ id: u.id, msg: 'Request failed' })
    } finally { setActionId(null) }
  }

  const isSelf     = (u: UserRow) => u.id === currentUser?.id
  const canSuspend = (u: UserRow) => !isSelf(u) && u.role !== 'admin'
  const canDelete  = (u: UserRow) => currentUser?.role === 'admin' && !isSelf(u) && u.role !== 'admin'
  const canResetPw = (u: UserRow) => currentUser?.role === 'admin' && !isSelf(u)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <span className="text-sm text-gray-500">{users.length} total</span>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {/* Table with horizontal scroll */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-gray-500 w-64">User</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Verification</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500 whitespace-nowrap">Activity</th>
              <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">Joined</th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  <User size={32} className="mx-auto mb-2" />
                  No users found
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <React.Fragment key={u.id}>
                  <tr className={`transition-colors ${u.suspended ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}>

                    {/* User */}
                    <td className="px-5 py-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className={`font-medium truncate ${u.suspended ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                              {u.name}
                            </p>
                            {u.suspended && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                SUSPENDED
                              </span>
                            )}
                            {isSelf(u) && (
                              <span className="text-[10px] text-gray-400 italic">(you)</span>
                            )}
                            {resetSuccess === u.id && (
                              <span className="text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                PW reset ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${ROLE_STYLES[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_ICONS[u.role]}
                        {u.role}
                      </span>
                    </td>

                    {/* Verification (farmers only) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {u.role === 'farmer' ? (
                        u.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                            <ShieldCheck size={11} /> Verified
                          </span>
                        ) : u.idImageUrl ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                            Pending
                            <a href={u.idImageUrl} target="_blank" rel="noopener noreferrer"
                              className="hover:text-amber-900 ml-0.5" title="View submitted ID">
                              <ExternalLink size={10} />
                            </a>
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No ID</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Activity */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      <span className="text-xs text-gray-600">
                        {u._count.products} prod{u._count.products !== 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-300 mx-1">·</span>
                      <span className="text-xs text-gray-600">
                        {u._count.orders} order{u._count.orders !== 1 ? 's' : ''}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(u.createdAt).toLocaleDateString('en-PH')}
                    </td>

                    {/* Actions — icon-only with title tooltips */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                        {actionId === u.id && (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        )}

                        {/* Verify / Unverify (farmer with submitted ID) */}
                        {u.role === 'farmer' && u.idImageUrl && (
                          <button
                            onClick={() => handleVerify(u)}
                            disabled={actionId === u.id}
                            title={u.verified ? 'Revoke verification' : 'Verify farmer'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                              u.verified
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            <ShieldCheck size={14} />
                          </button>
                        )}

                        {/* Suspend / Reactivate */}
                        {canSuspend(u) && (
                          <button
                            onClick={() => handleSuspend(u)}
                            disabled={actionId === u.id}
                            title={u.suspended ? 'Reactivate account' : 'Suspend account'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                              u.suspended
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            }`}
                          >
                            {u.suspended ? <CheckCircle size={14} /> : <Ban size={14} />}
                          </button>
                        )}

                        {/* Reset PW */}
                        {canResetPw(u) && (
                          <button
                            onClick={() => { setResetTarget(u); setNewPw(''); setResetError('') }}
                            disabled={actionId === u.id}
                            title="Reset password"
                            className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors disabled:opacity-40"
                          >
                            <KeyRound size={14} />
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete(u) && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={actionId === u.id}
                            title="Delete user"
                            className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}

                        {isSelf(u) && !canResetPw(u) && (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Inline error row */}
                  {actionError?.id === u.id && (
                    <tr className="bg-red-50">
                      <td colSpan={6} className="px-5 py-2">
                        <span className="flex items-center gap-2 text-xs text-red-700">
                          <AlertTriangle size={13} />
                          {actionError.msg}
                          <button onClick={() => setActionError(null)} className="ml-auto text-red-500 hover:text-red-700 underline">
                            Dismiss
                          </button>
                        </span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Hover action icons to see labels. Accounts with active orders cannot be deleted — suspend them instead.
      </p>

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { setResetTarget(null); setNewPw(''); setResetError('') }} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Reset Password</h3>
              <button onClick={() => { setResetTarget(null); setNewPw(''); setResetError('') }} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Set a new password for <strong>{resetTarget.name}</strong>.
            </p>
            {resetError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetError}</p>
            )}
            <input
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
              placeholder="New password (min 6 characters)"
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <div className="flex gap-2">
              <button
                onClick={handleResetPassword}
                disabled={actionId === resetTarget.id || !newPw.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionId === resetTarget.id ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Set Password
              </button>
              <button
                onClick={() => { setResetTarget(null); setNewPw(''); setResetError('') }}
                className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
