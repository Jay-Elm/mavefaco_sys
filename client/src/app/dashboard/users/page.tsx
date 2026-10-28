'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { refreshNavBadges } from '@/components/NavBadge'
import {
  Loader2, Shield, User, Leaf, ShoppingBag,
  Ban, CheckCircle, Trash2, AlertTriangle, ShieldCheck,
  IdCard, UserCheck, KeyRound, X, Search, ChevronUp, ChevronDown, ChevronsUpDown, Download,
  ShieldAlert, ShieldOff,
} from 'lucide-react'
import { downloadCSV } from '@/lib/csv'
import { useDialog } from '@/contexts/DialogContext'
import IdReviewPanel from '@/components/idVerification/IdReviewPanel'

interface UserRow {
  id: number
  name: string
  email: string
  role: string
  suspended: boolean
  // Status of the latest ID submission, if any.
  idStatus: 'pending' | 'approved' | 'rejected' | null
  verified: boolean
  verifiedInPersonAt: string | null
  totpEnabled: boolean
  createdAt: string
  _count: { products: number; orders: number }
}

const ROLE_STYLES: Record<string, string> = {
  admin:    'bg-red-100 text-red-700',
  manager:  'bg-purple-100 text-purple-700',
  farmer:   'bg-shoot text-paddy',
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
  const dialog = useDialog()
  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [actionId, setActionId]   = useState<number | null>(null)
  const [actionError, setActionError] = useState<{ id: number; msg: string } | null>(null)
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null)
  const [reviewing, setReviewing] = useState<UserRow | null>(null)
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
    if (!(await dialog.confirm({ title: `${next ? 'Suspend' : 'Reactivate'} ${u.name}?`, message: next ? 'They will be signed out and unable to log in until reactivated.' : 'They will be able to log in again.', confirmLabel: next ? 'Suspend' : 'Reactivate', tone: next ? 'danger' : 'default' }))) return
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

  async function handleVerification(u: UserRow) {
    if (!token) return
    const revoke = u.verified
    const ok = await dialog.confirm(revoke
      ? { title: `Revoke ${u.name}'s verification?`, message: "They won't be able to list new products until they're verified again.", confirmLabel: 'Revoke', tone: 'danger' }
      : { title: `Mark ${u.name} as verified in person?`, message: "Use this after checking their government ID at the cooperative office. They'll be able to list products.", confirmLabel: 'Verified in person' })
    if (!ok) return
    setActionId(u.id); setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(revoke ? { verified: false } : { verifiedInPerson: true }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id: u.id, msg: data.error }); return }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? {
        ...x,
        verified: data.verified,
        verifiedInPersonAt: data.verifiedInPersonAt,
        // Verifying in person closes a pending ID submission as approved.
        idStatus: !revoke && x.idStatus === 'pending' ? 'approved' : x.idStatus,
      } : x)))
      refreshNavBadges()
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

  async function handleResetMfa(u: UserRow) {
    if (!token) return
    if (!(await dialog.confirm({ title: `Reset two-factor authentication for ${u.name}?`, message: 'They will need to set it up again from scratch on their next login.', confirmLabel: 'Reset 2FA', tone: 'danger' }))) return
    setActionId(u.id); setActionError(null)
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ resetMfa: true }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id: u.id, msg: data.error }); return }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, totpEnabled: false } : x)))
    } catch {
      setActionError({ id: u.id, msg: 'Request failed' })
    } finally { setActionId(null) }
  }

  async function handleDelete(u: UserRow) {
    if (!token) return
    if (!(await dialog.confirm({ title: `Permanently delete "${u.name}"?`, message: 'Their name, email, login, reviews and messages are removed, and their products leave the shop. Past orders and audit history are kept under "Deleted user". Blocked only if they have active orders.\n\nThis cannot be undone.', confirmLabel: 'Delete user', tone: 'danger' }))) return
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
  // Managers can only act on farmers and customers (see the PATCH route).
  const canSuspend = (u: UserRow) =>
    !isSelf(u) && u.role !== 'admin' && (currentUser?.role === 'admin' || u.role !== 'manager')
  const canDelete  = (u: UserRow) => currentUser?.role === 'admin' && !isSelf(u) && u.role !== 'admin'
  // Another admin's password can't be reset here (see the PATCH route's
  // guard) — they use forgot-password. Their 2FA can, for lost-device recovery.
  const canResetPw = (u: UserRow) => currentUser?.role === 'admin' && !isSelf(u) && u.role !== 'admin'
  const canResetMfa = (u: UserRow) =>
    currentUser?.role === 'admin' && !isSelf(u) && (u.role === 'manager' || u.role === 'admin') && u.totpEnabled

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  const activeFilters = search || filterRole || filterStatus !== 'all'

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-soil">Users</h1>
        <span className="text-sm text-gray-500">{users.length} total</span>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative basis-full sm:basis-0 flex-1 sm:min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input aria-label="Search by name or email"
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-paddy"
          />
        </div>

        <select
          aria-label="Filter by role"
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-paddy"
        >
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="farmer">Farmer</option>
          <option value="customer">Customer</option>
        </select>

        <select
          aria-label="Filter by account status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'suspended')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-paddy"
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

        <span className="ml-auto text-xs text-gray-500">
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
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
                <td colSpan={7} className="text-center py-12 text-gray-500">
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
                            <p className={`font-medium truncate ${u.suspended ? 'text-gray-500 line-through' : 'text-soil'}`}>
                              {u.name}
                            </p>
                            {u.suspended && (
                              <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                SUSPENDED
                              </span>
                            )}
                            {isSelf(u) && (
                              <span className="text-[10px] text-gray-500 italic">(you)</span>
                            )}
                            {resetSuccess === u.id && (
                              <span className="text-[10px] text-paddy bg-shoot px-1.5 py-0.5 rounded whitespace-nowrap">
                                PW reset ✓
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full capitalize ${ROLE_STYLES[u.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_ICONS[u.role]}
                        {u.role}
                      </span>
                      {(u.role === 'admin' || u.role === 'manager') && (
                        <span
                          title={u.totpEnabled ? '2FA enabled' : '2FA not set up yet'}
                          className={`ml-1 inline-flex items-center ${u.totpEnabled ? 'text-paddy' : 'text-gray-300'}`}
                        >
                          {u.totpEnabled ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                        </span>
                      )}
                    </td>

                    {/* Verification (farmers only) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {u.role === 'farmer' ? (
                        u.verified ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-paddy bg-shoot px-2 py-0.5 rounded-full">
                            <ShieldCheck size={11} /> {u.verifiedInPersonAt ? 'In person' : 'Verified'}
                          </span>
                        ) : u.idStatus === 'pending' ? (
                          <button
                            type="button"
                            onClick={() => setReviewing(u)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-full"
                          >
                            <IdCard size={11} /> Review
                          </button>
                        ) : u.idStatus === 'rejected' ? (
                          <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">Rejected</span>
                        ) : (
                          <span className="text-xs text-gray-500">No ID</span>
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
                          <Loader2 size={14} className="animate-spin text-gray-500" />
                        )}

                        {/* ID submission */}
                        {u.role === 'farmer' && u.idStatus && (
                          <button
                            onClick={() => setReviewing(u)}
                            title="View ID submission" aria-label="View ID submission"
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                          >
                            <IdCard size={14} />
                          </button>
                        )}

                        {/* Verified in person / revoke */}
                        {u.role === 'farmer' && (
                          <button
                            onClick={() => handleVerification(u)}
                            disabled={actionId === u.id}
                            title={u.verified ? 'Revoke verification' : 'Mark verified in person'} aria-label={u.verified ? 'Revoke verification' : 'Mark verified in person'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                              u.verified
                                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                : 'bg-shoot text-paddy-deep hover:bg-[#cbe5b0]'
                            }`}
                          >
                            {u.verified ? <ShieldOff size={14} /> : <UserCheck size={14} />}
                          </button>
                        )}

                        {/* Suspend / Reactivate */}
                        {canSuspend(u) && (
                          <button
                            onClick={() => handleSuspend(u)}
                            disabled={actionId === u.id}
                            title={u.suspended ? 'Reactivate account' : 'Suspend account'} aria-label={u.suspended ? 'Reactivate account' : 'Suspend account'}
                            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
                              u.suspended
                                ? 'bg-shoot text-paddy-deep hover:bg-[#cbe5b0]'
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
                            title="Reset password" aria-label="Reset password"
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-40"
                          >
                            <KeyRound size={14} />
                          </button>
                        )}

                        {/* Reset MFA */}
                        {canResetMfa(u) && (
                          <button
                            onClick={() => handleResetMfa(u)}
                            disabled={actionId === u.id}
                            title="Reset two-factor authentication" aria-label="Reset two-factor authentication"
                            className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-40"
                          >
                            <ShieldOff size={14} />
                          </button>
                        )}

                        {/* Delete */}
                        {canDelete(u) && (
                          <button
                            onClick={() => handleDelete(u)}
                            disabled={actionId === u.id}
                            title="Delete user" aria-label="Delete user"
                            className="p-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}

                        {isSelf(u) && !canResetPw(u) && (
                          <span className="text-xs text-gray-500 italic">—</span>
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

      <p className="mt-4 text-xs text-gray-500">
        Hover action icons to see labels. Accounts with active orders cannot be deleted — suspend them instead.
      </p>

      {/* Reset Password Modal */}
      {reviewing && token && (
        <IdReviewPanel
          token={token}
          userId={reviewing.id}
          onClose={() => setReviewing(null)}
          onReviewed={(status) => {
            setUsers((prev) => prev.map((x) => (x.id === reviewing.id ? { ...x, idStatus: status, verified: status === 'approved', verifiedInPersonAt: status === 'approved' ? x.verifiedInPersonAt : null } : x)))
            setReviewing(null)
            refreshNavBadges()
          }}
        />
      )}

      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { setResetTarget(null); setNewPw(''); setResetError('') }} />
          <div className="relative bg-white rounded-card shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-soil">Reset Password</h3>
              <button onClick={() => { setResetTarget(null); setNewPw(''); setResetError('') }} className="text-gray-500 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600">
              Set a new password for <strong>{resetTarget.name}</strong>.
            </p>
            {resetError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{resetError}</p>
            )}
            <input aria-label="New password (12–128 characters)"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
              placeholder="New password (12–128 characters)"
              autoFocus
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
            />
            <div className="flex gap-2">
              <button
                onClick={handleResetPassword}
                disabled={actionId === resetTarget.id || !newPw.trim()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-paddy hover:bg-paddy-deep text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {actionId === resetTarget.id ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                Set Password
              </button>
              <button
                onClick={() => { setResetTarget(null); setNewPw(''); setResetError('') }}
                className="flex-1 border border-gray-300 text-gray-600 hover:border-gray-400 font-medium py-2.5 rounded-lg text-sm transition-colors"
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
