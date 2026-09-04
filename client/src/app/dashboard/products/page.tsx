'use client'

import React, { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Package, Trash2, AlertTriangle, CheckCircle, XCircle, Pencil, Search, ChevronUp, ChevronDown, ChevronsUpDown, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

interface ProductRow {
  id: number
  name: string
  price: number
  stock: number
  approved: boolean
  createdAt: string
  category: { name: string }
  farmer: { name: string; email: string }
  _count: { orderItems: number }
}

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
  const [products, setProducts]       = useState<ProductRow[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState('')
  const [actingId, setActingId]       = useState<number | null>(null)
  const [actionError, setActionError] = useState<{ id: number; msg: string } | null>(null)

  const [search, setSearch]           = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus]     = useState<'all' | 'approved' | 'pending'>('all')
  const [sortKey, setSortKey]         = useState<SortKey>('createdAt')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/products', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setProducts(data)))
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [token])

  const categories = useMemo(() => {
    const names = [...new Set(products.map((p) => p.category.name))].sort()
    return names
  }, [products])

  const displayed = useMemo(() => {
    let list = [...products]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (p) => p.name.toLowerCase().includes(q) || p.farmer.name.toLowerCase().includes(q)
      )
    }
    if (filterCategory) list = list.filter((p) => p.category.name === filterCategory)
    if (filterStatus === 'approved') list = list.filter((p) => p.approved)
    if (filterStatus === 'pending')  list = list.filter((p) => !p.approved)

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
  }, [products, search, filterCategory, filterStatus, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('asc') }
  }

  async function handleApprove(id: number, approved: boolean) {
    if (!token) return
    setActingId(id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approved }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id, msg: data.error }); return }
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, approved } : p)))
    } catch {
      setActionError({ id, msg: 'Request failed' })
    } finally {
      setActingId(null)
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Permanently delete "${name}"?\n\nThis cannot be undone.`)) return
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
    } catch {
      setActionError({ id, msg: 'Request failed' })
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  const pending   = products.filter((p) => !p.approved).length
  const approved  = products.filter((p) => p.approved).length

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
          {pending > 0 && (
            <span className="bg-yellow-100 text-yellow-800 font-semibold px-2.5 py-1 rounded-full">
              {pending} pending
            </span>
          )}
          <span>{approved} approved / {products.length} total</span>
        </div>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by product or farmer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'approved' | 'pending')}
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending">Pending</option>
        </select>

        {(search || filterCategory || filterStatus !== 'all') && (
          <button
            onClick={() => { setSearch(''); setFilterCategory(''); setFilterStatus('all') }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {displayed.length} of {products.length} products
        </span>
        <button
          onClick={() => downloadCSV(
            'products.csv',
            ['Product', 'Category', 'Farmer', 'Farmer Email', 'Price (PHP)', 'Stock', 'Orders', 'Status', 'Listed Date'],
            displayed.map((p) => [
              p.name, p.category.name, p.farmer.name, p.farmer.email,
              p.price.toFixed(2), p.stock, p._count.orderItems,
              p.approved ? 'Approved' : 'Pending',
              new Date(p.createdAt).toLocaleDateString('en-PH'),
            ])
          )}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-1.5 transition-colors shrink-0"
        >
          <Download size={12} /> Export CSV
        </button>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[780px] text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th
                className="px-5 py-3 text-left font-medium text-gray-500 cursor-pointer select-none hover:text-gray-700"
                onClick={() => toggleSort('name')}
              >
                Product <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
              </th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Category</th>
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
              <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {displayed.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  <Package size={32} className="mx-auto mb-2" />
                  {products.length === 0 ? 'No products yet' : 'No products match your filters'}
                </td>
              </tr>
            ) : (
              displayed.map((p) => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.createdAt).toLocaleDateString('en-PH')}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full">
                        {p.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{p.farmer.name}</td>
                    <td className="px-5 py-3 text-right font-semibold text-green-700">
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
                    <td className="px-5 py-3 text-center">
                      {p.approved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                          <CheckCircle size={11} /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actingId === p.id && (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        )}
                        {!p.approved ? (
                          <button
                            onClick={() => handleApprove(p.id, true)}
                            disabled={actingId === p.id}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-40"
                          >
                            <CheckCircle size={12} />
                            Approve
                          </button>
                        ) : (
                          <button
                            onClick={() => handleApprove(p.id, false)}
                            disabled={actingId === p.id}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200 transition-colors disabled:opacity-40"
                          >
                            <XCircle size={12} />
                            Revoke
                          </button>
                        )}
                        <Link
                          href={`/dashboard/products/${p.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          <Pencil size={12} />
                          Edit
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          disabled={actingId === p.id}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {actionError?.id === p.id && (
                    <tr className="bg-red-50">
                      <td colSpan={8} className="px-5 py-2">
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
    </div>
  )
}
