'use client'

import React, { useEffect, useState, useMemo } from 'react'
import StaffCropLink from '@/components/StaffCropLink'
import type { PickerCrop } from '@/components/CropPicker'
import { byCategory } from '@/lib/cropCategories'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { refreshNavBadges } from '@/components/NavBadge'
import { Loader2, Package, Trash2, AlertTriangle, CheckCircle, Ban, Eye, Search, ChevronUp, ChevronDown, ChevronsUpDown, Download, ArchiveRestore, Archive, Clock } from 'lucide-react'
import Tip from '@/components/Tip'
import { downloadCSV } from '@/lib/csv'
import SuspendListingModal, { type SuspendResult } from '@/components/SuspendListingModal'
import { suspensionDeadline } from '@/validators/productSuspension'
import { useDialog } from '@/contexts/DialogContext'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'

interface ProductRow {
  id: number
  name: string
  price: number
  stock: number
  approved: boolean
  createdAt: string
  archivedAt: string | null
  suspendedAt: string | null
  suspensionReasons: string[]
  suspensionNote: string | null
  category: { name: string }
  farmer: { name: string; email: string }
  _count: { orderItems: number }
  cropTypeId: number | null
  notACrop: boolean
  cropType: { id: number; name: string } | null
}

/** Live, and neither linked to a crop nor marked "not a farm crop". */
const unlinked = (p: ProductRow) => !p.archivedAt && !p.cropTypeId && !p.notACrop

type StatusFilter = 'all' | 'approved' | 'pending' | 'suspended' | 'archived'

const statusOf = (p: ProductRow) =>
  p.archivedAt ? 'Archived' : p.suspendedAt ? 'Suspended' : p.approved ? 'Approved' : 'Pending'

const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-PH')
// The round icon buttons in the Actions column.
const ICON_BTN = 'inline-flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40'

type SortKey = 'name' | 'price' | 'stock' | 'createdAt' | 'orders'
type SortDir = 'asc' | 'desc'

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={13} className="text-gray-300 inline ml-1" />
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-gray-600 inline ml-1" />
    : <ChevronDown size={13} className="text-gray-600 inline ml-1" />
}

export default function DashboardProductsPage() {
  const { token } = useAuth()
  const live = useLiveVersion()
  const dialog = useDialog()
  const [products, setProducts]       = useState<ProductRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [actingId, setActingId]       = useState<number | null>(null)
  const [actionError, setActionError] = useState<{ id: number; msg: string } | null>(null)
  const [suspending, setSuspending]   = useState<ProductRow | null>(null)

  const [search, setSearch]           = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus]     = useState<StatusFilter>('all')
  const [filterCrop, setFilterCrop]         = useState<'all' | 'unlinked'>('all')
  const [crops, setCrops]                   = useState<PickerCrop[]>([])
  // Archived products come from a separate request, loaded the first time
  // the "Archived" filter is picked.
  const [archivedProducts, setArchivedProducts] = useState<ProductRow[] | null>(null)
  const showingArchived = filterStatus === 'archived'
  const source = useMemo(
    () => (showingArchived ? (archivedProducts ?? []) : products),
    [showingArchived, archivedProducts, products],
  )
  const [sortKey, setSortKey]         = useState<SortKey>('createdAt')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setProducts(data)))
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [token, live])

  useEffect(() => {
    if (!token || !showingArchived || archivedProducts !== null) return
    fetch('/api/admin/products?archived=1', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setArchivedProducts(data)))
      .catch(() => setError('Failed to load archived products'))
  }, [token, showingArchived, archivedProducts])

  const categories = useMemo(() => {
    const names = [...new Set(source.map((p) => p.category.name))].sort()
    return names
  }, [source])

  const displayed = useMemo(() => {
    let list = [...source]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.farmer.name.toLowerCase().includes(q)
      )
    }
    if (filterCategory) list = list.filter((p) => p.category.name === filterCategory)
    if (filterCrop === 'unlinked') list = list.filter(unlinked)
    if (filterStatus === 'approved')  list = list.filter((p) => p.approved)
    if (filterStatus === 'pending')   list = list.filter((p) => !p.approved && !p.suspendedAt)
    if (filterStatus === 'suspended') list = list.filter((p) => p.suspendedAt)

    list.sort((a, b) => {
      let diff = 0
      if (sortKey === 'name')      diff = a.name.localeCompare(b.name)
      if (sortKey === 'price')     diff = a.price - b.price
      if (sortKey === 'stock')     diff = a.stock - b.stock
      if (sortKey === 'createdAt') diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      if (sortKey === 'orders')    diff = a._count.orderItems - b._count.orderItems
      return sortDir === 'asc' ? diff : -diff
    })

    return list
  }, [source, search, filterCategory, filterStatus, filterCrop, sortKey, sortDir])

  // The crop list, for linking listings to the crops they sell.
  useEffect(() => {
    if (!token) return
    fetch('/api/crop-types', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setCrops(byCategory(d)))
      .catch(() => {})
  }, [token])

  function linked(id: number, link: { cropTypeId: number | null; notACrop: boolean; cropType: { id: number; name: string } | null }) {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...link } : p)))
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  async function handleApprove(id: number) {
    if (!token) return
    setActingId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approved: true }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id, msg: data.error }); return }
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, approved: true } : p)))
      refreshNavBadges()
    } catch {
      setActionError({ id, msg: 'Request failed' })
    } finally {
      setActingId(null)
    }
  }

  async function handleRestore(id: number) {
    if (!token) return
    setActingId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/products/${id}/restore`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id, msg: data.error }); return }
      setArchivedProducts((prev) => (prev ?? []).filter((p) => p.id !== id))
      setProducts((prev) => [data, ...prev])
    } catch {
      setActionError({ id, msg: 'Request failed' })
    } finally {
      setActingId(null)
    }
  }

  function handleSuspended(id: number, result: SuspendResult & { suspensionNote: string | null }) {
    setSuspending(null)
    refreshNavBadges()
    setProducts((prev) => prev.map((p) => (p.id === id
      ? { ...p, approved: false, suspendedAt: result.suspendedAt, suspensionReasons: result.suspensionReasons, suspensionNote: result.suspensionNote }
      : p)))
    if (!result.emailSent)
      setActionError({ id, msg: "Suspended, but the email to the farmer couldn't be sent. The notice is still in their Messages." })
  }

  // Only offered on a suspended listing: deleting it now instead of waiting
  // for the automatic removal at the end of the suspension.
  async function handleDelete(id: number, name: string) {
    if (!(await dialog.confirm({ title: `Delete "${name}" now?`, message: 'This listing is suspended. If it has past orders or reviews it is archived so order history stays intact; otherwise it is deleted. This cannot be undone.', confirmLabel: 'Delete listing', tone: 'danger' }))) return
    if (!token) return
    setActingId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id, msg: data.error }); return }
      setProducts((prev) => prev.filter((p) => p.id !== id))
      if (data.archived) setArchivedProducts(null)
    } catch {
      setActionError({ id, msg: 'Request failed' })
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  const pending   = products.filter((p) => !p.approved && !p.suspendedAt).length
  const suspended = products.filter((p) => p.suspendedAt).length
  const approved  = products.filter((p) => p.approved).length
  const notLinked = products.filter(unlinked).length

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
        <h1 className="text-2xl font-bold text-soil">Products</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {pending > 0 && (
            <span className="bg-yellow-100 text-yellow-800 font-semibold px-2.5 py-1 rounded-full">
              {pending} pending
            </span>
          )}
          {suspended > 0 && (
            <span className="bg-red-100 text-red-700 font-semibold px-2.5 py-1 rounded-full">
              {suspended} suspended
            </span>
          )}
          {notLinked > 0 && (
            <button
              onClick={() => setFilterCrop('unlinked')}
              title="Listings whose sales don't count on the Market page until they're linked to a crop"
              className="bg-amber-100 text-amber-800 font-semibold px-2.5 py-1 rounded-full hover:bg-amber-200"
            >
              {notLinked} not linked to a crop
            </button>
          )}
          <span>{approved} approved / {products.length} total</span>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input aria-label="Search by product or farmer"
            type="text"
            placeholder="Search by product or farmer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-paddy"
          />
        </div>

        <select
          aria-label="Filter by category"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-paddy"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          aria-label="Filter by status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-paddy"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="archived">Archived</option>
        </select>

        <select
          aria-label="Filter by crop link"
          value={filterCrop}
          onChange={(e) => setFilterCrop(e.target.value as 'all' | 'unlinked')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-paddy"
        >
          <option value="all">Any crop link</option>
          <option value="unlinked">Not linked to a crop</option>
        </select>

        {(search || filterCategory || filterStatus !== 'all' || filterCrop !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus('all'); setFilterCrop('all') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-500">
          {displayed.length} of {source.length} {showingArchived ? 'archived ' : ''}products
        </span>
        <button
          onClick={() => downloadCSV(
            'products.csv',
            ['Product', 'Category', 'Crop', 'Farmer', 'Farmer Email', 'Price (PHP)', 'Stock', 'Orders', 'Status', 'Listed Date'],
            displayed.map((p) => [
              p.name, p.category.name, p.notACrop ? 'Not a farm crop' : p.cropType?.name ?? '', p.farmer.name, p.farmer.email,
              p.price.toFixed(2), p.stock, p._count.orderItems,
              statusOf(p),
              fmtDate(p.createdAt),
            ])
          )}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-5 py-3 text-left font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('name')}
              >
                Product <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Category</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Crop</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Farmer</th>
              <th
                className="px-5 py-3 text-right font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('price')}
              >
                Price <SortIcon col="price" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="px-5 py-3 text-center font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('stock')}
              >
                Stock <SortIcon col="stock" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th
                className="px-5 py-3 text-center font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('orders')}
              >
                Orders <SortIcon col="orders" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-3 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-3 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-500">
                  <Package size={32} className="mx-auto mb-2" />
                  {showingArchived && archivedProducts === null
                    ? 'Loading archived products…'
                    : source.length === 0
                      ? (showingArchived ? 'No archived products' : 'No products yet')
                      : 'No products match your filters'}
                </td>
              </tr>
            ) : (
              displayed.map((p) => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-soil">{p.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString('en-PH')}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-shoot text-paddy-deep text-xs font-medium px-2 py-0.5 rounded-full">
                        {p.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {p.archivedAt ? (
                        <span className="text-xs text-gray-500">{p.notACrop ? 'Not a farm crop' : p.cropType?.name ?? '—'}</span>
                      ) : (
                        <StaffCropLink productId={p.id} cropTypeId={p.cropTypeId} notACrop={p.notACrop} crops={crops} token={token} onSaved={(l) => linked(p.id, l)} />
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.farmer.name}</td>
                    <td className="px-5 py-3 text-right font-semibold text-paddy">
                      ₱{p.price.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-medium ${p.stock > 0 ? 'text-gray-700' : 'text-red-500'}`}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-gray-600">
                      {p._count.orderItems}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {(() => {
                        const status = p.archivedAt
                          ? { label: `Archived ${fmtDate(p.archivedAt)}${p.approved ? ' (was approved)' : ' (was pending)'}`, icon: <Archive size={14} />, cls: 'text-gray-600 bg-gray-100' }
                          : p.suspendedAt
                            ? { label: `Suspended; deleted after ${fmtDate(suspensionDeadline(p.suspendedAt))} unless resubmitted`, icon: <Ban size={14} />, cls: 'text-red-700 bg-red-100' }
                            : p.approved
                              ? { label: 'Approved', icon: <CheckCircle size={14} />, cls: 'text-paddy bg-shoot' }
                              : { label: 'Pending review', icon: <Clock size={14} />, cls: 'text-yellow-700 bg-yellow-100' }
                        return (
                          <Tip label={status.label}>
                            <span tabIndex={0} role="img" aria-label={status.label} className={`inline-flex items-center justify-center w-7 h-7 rounded-full ${status.cls}`}>
                              {status.icon}
                            </span>
                          </Tip>
                        )
                      })()}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {actingId === p.id && (
                          <Loader2 size={14} className="animate-spin text-gray-500" />
                        )}
                        {p.archivedAt ? (
                          <Tip label={p.approved ? 'Restore (goes straight back into the shop)' : 'Restore (returns to pending review)'} align="end">
                            <button
                              onClick={() => handleRestore(p.id)}
                              disabled={actingId === p.id}
                              aria-label={p.approved ? 'Restore — goes straight back into the shop' : 'Restore — returns to pending review'}
                              className={`${ICON_BTN} bg-field text-paddy hover:bg-paddy/10`}
                            >
                              <ArchiveRestore size={15} />
                            </button>
                          </Tip>
                        ) : (<>
                        {!p.approved && !p.suspendedAt && (
                          <Tip label="Approve" align="end">
                            <button
                              onClick={() => handleApprove(p.id)}
                              disabled={actingId === p.id}
                              aria-label="Approve"
                              className={`${ICON_BTN} bg-shoot text-paddy hover:bg-paddy/15`}
                            >
                              <CheckCircle size={15} />
                            </button>
                          </Tip>
                        )}
                        <Tip label="View" align="end">
                          <Link
                            href={`/dashboard/products/${p.id}`}
                            aria-label="View"
                            className={`${ICON_BTN} bg-blue-100 text-blue-700 hover:bg-blue-200`}
                          >
                            <Eye size={15} />
                          </Link>
                        </Tip>
                        {p.suspendedAt ? (
                          <Tip label="Delete" align="end">
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              disabled={actingId === p.id}
                              aria-label="Delete"
                              className={`${ICON_BTN} bg-red-100 text-red-700 hover:bg-red-200`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </Tip>
                        ) : (
                          <Tip label="Suspend" align="end">
                            <button
                              onClick={() => { setActionError(null); setSuspending(p) }}
                              disabled={actingId === p.id}
                              aria-label="Suspend"
                              className={`${ICON_BTN} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`}
                            >
                              <Ban size={15} />
                            </button>
                          </Tip>
                        )}
                        </>)}
                      </div>
                    </td>
                  </tr>

                  {actionError?.id === p.id && (
                    <tr className="bg-red-50">
                      <td colSpan={9} className="px-5 py-2">
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
      </div>

      {suspending && token && (
        <SuspendListingModal
          product={suspending}
          token={token}
          onDone={(result) => handleSuspended(suspending.id, result)}
          onCancel={() => setSuspending(null)}
        />
      )}
    </div>
  )
}
