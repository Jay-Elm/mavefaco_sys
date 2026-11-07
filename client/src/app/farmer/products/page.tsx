'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Package, Trash2, Pencil, Plus, AlertTriangle, CheckCircle, Clock, Download, XCircle, Ban, Sprout } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'
import { reasonLabels, suspensionDeadline } from '@/validators/productSuspension'
import { useDialog } from '@/contexts/DialogContext'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import ListToolbar from '@/components/ListToolbar'
import StockQuickEdit from '@/components/StockQuickEdit'

interface ProductRow {
  id: number
  name: string
  price: number
  stock: number
  unit: string
  approved: boolean
  createdAt: string
  suspendedAt: string | null
  suspensionReasons: string[]
  category: { name: string }
  cropTypeId: number | null
  notACrop: boolean
  cropType: { id: number; name: string } | null
}

const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-PH')

const LOW_STOCK_THRESHOLD = 5

type StatusFilter = 'all' | 'approved' | 'pending' | 'suspended'
type StockFilter = 'all' | 'in' | 'low' | 'out'
type Sort = 'newest' | 'oldest' | 'name' | 'price-desc' | 'price-asc' | 'stock-asc' | 'stock-desc'

const statusOf = (p: ProductRow): Exclude<StatusFilter, 'all'> => (p.suspendedAt ? 'suspended' : p.approved ? 'approved' : 'pending')

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
        <XCircle size={11} /> Out of Stock
      </span>
    )
  if (stock <= LOW_STOCK_THRESHOLD)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
        <AlertTriangle size={11} /> Low ({stock})
      </span>
    )
  return <span className="text-xs font-medium text-gray-700">{stock}</span>
}

export default function FarmerProductsPage() {
  const { token, user } = useAuth()
  const live = useLiveVersion()
  const dialog = useDialog()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: number; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [stockFilter, setStockFilter] = useState<StockFilter>('all')
  const [category, setCategory] = useState('')
  const [sort, setSort] = useState<Sort>('newest')

  const categories = useMemo(() => [...new Set(products.map((p) => p.category.name))].sort(), [products])

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = products.filter((p) =>
      (!q || p.name.toLowerCase().includes(q)) &&
      (status === 'all' || statusOf(p) === status) &&
      (!category || p.category.name === category) &&
      (stockFilter === 'all' ||
        (stockFilter === 'out' && p.stock === 0) ||
        (stockFilter === 'low' && p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD) ||
        (stockFilter === 'in' && p.stock > 0)),
    )
    const time = (p: ProductRow) => new Date(p.createdAt).getTime()
    return list.sort((a, b) => {
      switch (sort) {
        case 'oldest': return time(a) - time(b)
        case 'name': return a.name.localeCompare(b.name)
        case 'price-desc': return b.price - a.price
        case 'price-asc': return a.price - b.price
        case 'stock-asc': return a.stock - b.stock
        case 'stock-desc': return b.stock - a.stock
        default: return time(b) - time(a)
      }
    })
  }, [products, search, status, stockFilter, category, sort])
  const filtered = search.trim() !== '' || status !== 'all' || stockFilter !== 'all' || category !== ''

  useEffect(() => {
    if (!token || !user) return
    fetch(`/api/products?farmerId=${user.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setProducts(data)))
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [token, user, live])

  // Stock alone goes live at once: no review needed.
  async function saveStock(id: number, stock: number): Promise<string | null> {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ stock }),
      })
      const data = await res.json()
      if (!res.ok) return data.error ?? 'Could not save the stock'
      setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock } : p)))
      return null
    } catch {
      return 'Could not save the stock'
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!(await dialog.confirm({ title: `Delete "${name}"?`, message: 'It will disappear from the shop. If it has past orders or reviews it is archived so order history stays intact; otherwise it is deleted. This cannot be undone.', confirmLabel: 'Delete listing', tone: 'danger' }))) return
    if (!token) return
    setDeletingId(id)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setDeleteError({ id, msg: data.error }); return }
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setDeleteError({ id, msg: 'Request failed' })
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-soil">My Products</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadCSV(
              'my-products.csv',
              ['Product', 'Category', 'Price (PHP)', 'Stock', 'Status', 'Listed Date'],
              products.map((p) => [
                p.name, p.category.name, p.price.toFixed(2), p.stock,
                p.suspendedAt ? 'Suspended' : p.approved ? 'Approved' : 'Pending',
                new Date(p.createdAt).toLocaleDateString('en-PH'),
              ])
            )}
            disabled={products.length === 0}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
          >
            <Download size={12} /> Export CSV
          </button>
          <Link
            href="/farmer/products/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-paddy text-white text-sm font-medium rounded-lg hover:bg-paddy-deep transition-colors"
          >
            <Plus size={16} />
            Add Product
          </Link>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      {/* Suspended listings: hidden from customers until edited and resubmitted */}
      {products.some((p) => p.suspendedAt) && (
        <div className="mb-5 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <Ban size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800">
            <p className="font-semibold">Some of your listings were suspended by MaVeFaCo staff</p>
            <p className="mt-0.5">
              They are hidden from customers. Edit a listing to fix the issues and resubmit it for review, or delete it.
              A suspended listing that isn&apos;t resubmitted is deleted automatically on the date shown.
            </p>
          </div>
        </div>
      )}

      {/* Listings not linked to a crop: their sales don't count on the Market page */}
      {(() => {
        const unlinked = products.filter((p) => !p.cropTypeId && !p.notACrop)
        if (unlinked.length === 0) return null
        return (
          <div className="mb-5 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
            <Sprout size={18} className="text-blue-700 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-semibold">
                {unlinked.length === 1 ? '1 listing isn’t' : `${unlinked.length} listings aren’t`} linked to a crop yet
              </p>
              <p className="mt-0.5">
                Their sales don&apos;t count on the Market page until they are. Edit a listing and choose its crop (or &quot;Not a farm
                crop&quot;):{' '}
                {unlinked.slice(0, 4).map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && ', '}
                    <Link href={`/farmer/products/${p.id}/edit`} className="font-medium underline">{p.name}</Link>
                  </span>
                ))}
                {unlinked.length > 4 && ` and ${unlinked.length - 4} more`}. Cooperative staff may also link them for you.
              </p>
            </div>
          </div>
        )
      })()}

      {/* Stock alert banner */}
      {(() => {
        const outOfStock = products.filter((p) => p.stock === 0)
        const lowStock   = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD)
        if (outOfStock.length === 0 && lowStock.length === 0) return null
        return (
          <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800 space-y-1">
              {outOfStock.length > 0 && (
                <p>
                  <span className="font-semibold">Out of stock:</span>{' '}
                  {outOfStock.map((p) => p.name).join(', ')}
                </p>
              )}
              {lowStock.length > 0 && (
                <p>
                  <span className="font-semibold">Running low (≤ {LOW_STOCK_THRESHOLD} units):</span>{' '}
                  {lowStock.map((p) => `${p.name} (${p.stock})`).join(', ')}
                </p>
              )}
            </div>
          </div>
        )
      })()}

      {products.length > 0 && (
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search my products"
          filters={[
            { label: 'Status', value: status, onChange: (v) => setStatus(v as StatusFilter), options: [
              { value: 'all', label: 'All statuses' }, { value: 'approved', label: 'Approved' },
              { value: 'pending', label: 'Pending' }, { value: 'suspended', label: 'Suspended' },
            ] },
            { label: 'Stock', value: stockFilter, onChange: (v) => setStockFilter(v as StockFilter), options: [
              { value: 'all', label: 'Any stock' }, { value: 'in', label: 'In stock' },
              { value: 'low', label: `Running low (≤ ${LOW_STOCK_THRESHOLD})` }, { value: 'out', label: 'Out of stock' },
            ] },
            { label: 'Category', value: category, onChange: setCategory, options: [
              { value: '', label: 'All categories' }, ...categories.map((c) => ({ value: c, label: c })),
            ] },
          ]}
          sort={{ label: 'Sort by', value: sort, onChange: (v) => setSort(v as Sort), options: [
            { value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' },
            { value: 'name', label: 'Name (A–Z)' },
            { value: 'price-desc', label: 'Price: high to low' }, { value: 'price-asc', label: 'Price: low to high' },
            { value: 'stock-asc', label: 'Stock: low to high' }, { value: 'stock-desc', label: 'Stock: high to low' },
          ] }}
          shown={displayed.length}
          total={products.length}
          noun="products"
          onClear={filtered ? () => { setSearch(''); setStatus('all'); setStockFilter('all'); setCategory('') } : undefined}
        />
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Product</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Category</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Price</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Stock</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">
                  <Package size={32} className="mx-auto mb-2" />
                  No products yet
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">No products match these filters</td>
              </tr>
            ) : (
              displayed.map((p) => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="font-medium text-soil">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.notACrop ? 'Not a farm crop' : p.cropType ? `Crop: ${p.cropType.name}` : 'Not linked to a crop'}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(p.createdAt).toLocaleDateString('en-PH')}
                      </p>
                      {p.suspendedAt && (
                        <p className="text-xs text-red-600 mt-0.5">{reasonLabels(p.suspensionReasons).join('; ')}</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="bg-shoot text-paddy-deep text-xs font-medium px-2 py-0.5 rounded-full">
                        {p.category.name}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-paddy">
                      ₱{p.price.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StockQuickEdit stock={p.stock} unit={p.unit} badge={<StockBadge stock={p.stock} />} onSave={(stock) => saveStock(p.id, stock)} />
                    </td>
                    <td className="px-5 py-3 text-center">
                      {p.suspendedAt ? (
                        <span className="inline-flex flex-col items-center text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-lg">
                          <span className="inline-flex items-center gap-1"><Ban size={11} /> Suspended</span>
                          <span className="font-normal">deleted {fmtDate(suspensionDeadline(p.suspendedAt))}</span>
                        </span>
                      ) : p.approved ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-paddy bg-shoot px-2 py-0.5 rounded-full">
                          <CheckCircle size={11} /> Approved
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">
                          <Clock size={11} /> Pending
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {deletingId === p.id && (
                          <Loader2 size={14} className="animate-spin text-gray-500" />
                        )}
                        <Link
                          href={`/farmer/products/${p.id}/edit`}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                        >
                          <Pencil size={12} />
                          {p.suspendedAt ? 'Fix & resubmit' : 'Edit'}
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          disabled={deletingId === p.id}
                          className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>

                  {deleteError?.id === p.id && (
                    <tr className="bg-red-50">
                      <td colSpan={6} className="px-5 py-2">
                        <span className="flex items-center gap-2 text-xs text-red-700">
                          <AlertTriangle size={13} />
                          {deleteError.msg}
                          <button
                            onClick={() => setDeleteError(null)}
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
