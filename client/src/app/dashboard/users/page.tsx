'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Loader2, Shield, User, Leaf, ShoppingBag,
  Ban, CheckCircle, Trash2, AlertTriangle,
} from 'lucide-react'

interface UserRow {
  id: number
  name: string
  email: string
  role: string
  suspended: boolean
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
  admin:    <Shield size={12} />,
  manager:  <Shield size={12} />,
  farmer:   <Leaf size={12} />,
  customer: <ShoppingBag size={12} />,
}

export default function UsersPage() {
  const { token, user: currentUser } = useAuth()
  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [actionId, setActionId]   = useState<number | null>(null)
  const [actionError, setActionError] = useState<{ id: number; msg: string } | null>(null)

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
    setActionId(u.id)
    setActionError(null)
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
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(u: UserRow) {
    if (!token) return
    if (!confirm(`Permanently delete "${u.name}"?\n\nThis will also delete all their products. Orders will NOT be deleted — if this user has orders, deletion will be blocked.`)) return
    setActionId(u.id)
    setActionError(null)
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
    } finally {
      setActionId(null)
    }
  }

  const isSelf = (u: UserRow) => u.id === currentUser?.id
  const canSuspend = (u: UserRow) => !isSelf(u) && u.role !== 'admin'
  const canDelete  = (u: UserRow) =>
    currentUser?.role === 'admin' && !isSelf(u) && u.role !== 'admin'

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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-gray-500">User</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Products</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Orders</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Joined</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
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
                  <tr
                    className={`transition-colors ${u.suspended ? 'bg-red-50/40' : 'hover:bg-gray-50'}`}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div>
                          <p className={`font-medium ${u.suspended ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                            {u.name}
                          </p>
                          <p className="text-xs text-gray-400">{u.email}</p>
                        </div>
                        {u.suspended && (
                          <span className="text-xs font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            SUSPENDED
                          </span>
                        )}
                        {isSelf(u) && (
                          <span className="text-xs text-gray-400 italic">(you)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${ROLE_STYLES[u.role] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {ROLE_ICONS[u.role]}
                        {u.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">{u._count.products}</td>
                    <td className="px-5 py-3 text-center text-gray-600">{u._count.orders}</td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(u.createdAt).toLocaleDateString('en-PH')}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {actionId === u.id && (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        )}

                        {canSuspend(u) && (
                          <button
                            onClick={() => handleSuspend(u)}
                            disabled={actionId === u.id}
                            title={u.suspended ? 'Reactivate account' : 'Suspend account'}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                              u.suspended
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                            }`}
                          >
                            {u.suspended ? <CheckCircle size={12} /> : <Ban size={12} />}
                            {u.suspended ? 'Reactivate' : 'Suspend'}
                          </button>
                        )}

                        {canDelete(u) && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={actionId === u.id}
                            title="Permanently delete this user"
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        )}

                        {isSelf(u) && (
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
                          <button
                            onClick={() => setActionError(null)}
                            className="ml-auto text-red-500 hover:text-red-700 underline"
                          >
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
        * Admins can only be managed by other admins. Managers can suspend farmers and customers.
        Accounts with orders cannot be deleted — suspend them instead.
      </p>
    </div>
  )
}
