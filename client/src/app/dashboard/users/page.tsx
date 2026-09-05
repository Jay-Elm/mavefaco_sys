'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Loader2, Shield, User, Leaf, ShoppingBag,
  Ban, CheckCircle, Trash2, AlertTriangle, ShieldCheck,
  ExternalLink, KeyRound, X, Search, ChevronUp, ChevronDown, ChevronsUpDown, Download,
} from 'lucide-react'
import { downloadCSV } from '@/lib/csv'
import { isSafeUrl } from '@/lib/url'

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

type SortKey = 'name' | 'createdAt' | 'products' | 'orders'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-gray-300 inline ml-1" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-gray-600 inline ml-1" />
    : <ChevronDown size={13} className="text-gray-600 inline ml-1" />
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

  const [search, setSearch]           = useState('')
  const [filterRole, setFilterRole]   = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'suspended'>('all')
  const [sortKey, setSortKey]         = useState<SortKey>('createdAt')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setUsers(data)))
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false))
  }, [token])

  const displayed = useMemo(() => {
    let list = [...users]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      )
    }
    if (filterRole) list = list.filter((u) => u.role === filterRole)
    if (filterStatus === 'active')    list = list.filter((u) => !u.suspended)
    if (filterStatus === 'suspended') list = list.filter((u) => u.suspended)

    list.sort((a, b) => {
      let diff = 0
      if (sortKey === 'name')      diff = a.name.localeCompare(b.name)
      if (sortKey === 'createdAt') diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sortKey === 'products')  diff = a._count.products - b._count.products
      if (sortKey === 'orders')    diff = a._count.orders - b._count.orders
      return sortDir === 'asc' ? diff : -diff
    })

    return list
  }, [users, search, filterRole, filterStatus, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

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

  const activeFilters = search || filterRole || filterStatus !== 'all'

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <span className="text-sm text-gray-500">{users.length} total</span>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-0 sm:min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="farmer">Farmer</option>
          <option value="customer">Customer</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'suspended')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>

        {activeFilters && (
          <button
            onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus('all') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {displayed.length} of {users.length} users
        </span>
        <button
          onClick={() => downloadCSV(
            'users.csv',
            ['Name', 'Email', 'Role', 'Status', 'Verified', 'Products', 'Orders', 'Joined'],
            displayed.map((u) => [
              u.name, u.email, u.role,
              u.suspended ? 'Suspended' : 'Active',
              u.role === 'farmer' ? (u.verified ? 'Yes' : 'No') : '-',
              u._count.products, u._count.orders,
              new Date(u.createdAt).toLocaleDateString('en-PH'),
            ])
          )}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {/* Table with horizontal scroll */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-5 py-3 text-left font-medium text-gray-500 w-64 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('name')}
              >
                User <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-500">Role</th>
              <th className="px-4 py-3 text-center font-medium text-gray-500">Verification</th>
              <th
                className="px-4 py-3 text-center font-medium text-gray-500 whitespace-nowrap cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('products')}
              >
                Products <SortIcon col="products" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="px-4 py-3 text-center font-medium text-gray-500 whitespace-nowrap cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('orders')}
              >
                Orders <SortIcon col="orders" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('createdAt')}
              >
                Joined <SortIcon col="createdAt" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <User size={32} className="mx-auto mb-2" />
                  {users.length === 0 ? 'No users found' : 'No users match your filters'}
                </td>
              </tr>
            ) : (
              displayed.map((u) => (
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
                            {isSafeUrl(u.idImageUrl) && (
                              <a href={u.idImageUrl} target="_blank" rel="noopener noreferrer"
                                className="hover:text-amber-900 ml-0.5" title="View submitted ID">
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No ID</span>
                        )
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>

                    {/* Products */}
                    <td className="px-4 py-3 text-center text-xs text-gray-600 whitespace-nowrap">
                      {u._count.products}
                    </td>

                    {/* Orders */}
                    <td className="px-4 py-3 text-center text-xs text-gray-600 whitespace-nowrap">
                      {u._count.orders}
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
                      <td colSpan={7} className="px-5 py-2">
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
