'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Package, Trash2, AlertTriangle } from 'lucide-react'

interface ProductRow {
  id: number
  name: string
  price: number
  stock: number
  createdAt: string
  category: { name: string }
  farmer: { name: string; email: string }
}

export default function DashboardProductsPage() {
  const { token } = useAuth()
  const [products, setProducts]     = useState<ProductRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: number; msg: string } | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/products', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => (data.error ? setError(data.error) : setProducts(data)))
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Permanently delete "${name}"?\n\nThis cannot be undone.`)) return
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
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <span className="text-sm text-gray-500">{products.length} total</span>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Product</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Category</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Farmer</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Price</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Stock</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  <Package size={32} className="mx-auto mb-2" />
                  No products yet
                </td>
              </tr>
            ) : (
              products.map((p) => (
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
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {deletingId === p.id && (
                          <Loader2 size={14} className="animate-spin text-gray-400" />
                        )}
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
  )
}
