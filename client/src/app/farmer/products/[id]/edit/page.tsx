'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2 } from 'lucide-react'
import ImageUploader from '@/components/ImageUploader'

interface Category { id: number; name: string }

export default function EditProductPage() {
  const { token } = useAuth()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '', unit: 'piece', categoryId: '', imageUrl: '',
  })

  useEffect(() => {
    if (!token) return
    Promise.all([
      fetch(`/api/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([product, cats]) => {
      if (product.error) { setError(product.error); return }
      setForm({
        name: product.name,
        description: product.description,
        price: String(product.price),
        stock: String(product.stock),
        unit: product.unit ?? 'piece',
        categoryId: String(product.categoryId),
        imageUrl: product.imageUrl ?? '',
      })
      if (Array.isArray(cats)) setCategories(cats)
    }).finally(() => setLoading(false))
  }, [token, productId])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim(),
          price: parseFloat(form.price),
          stock: parseFloat(form.stock),
          unit: form.unit.trim() || 'piece',
          categoryId: parseInt(form.categoryId, 10),
          imageUrl: form.imageUrl.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to update product'); return }
      router.push('/farmer/products')
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
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
    <div className="p-4 sm:p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Product</h1>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            name="name" value={form.name} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            name="description" value={form.description} onChange={handleChange} required rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <input
              name="unit" list="unit-options" value={form.unit} onChange={handleChange} required
              placeholder="e.g. kg, piece, bundle"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <datalist id="unit-options">
              <option value="piece" />
              <option value="kg" />
              <option value="gram" />
              <option value="bundle" />
              <option value="pack" />
              <option value="bag" />
              <option value="tray" />
              <option value="dozen" />
              <option value="liter" />
              <option value="sack" />
              <option value="bottle" />
            </datalist>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price per {form.unit || 'unit'} (₱)</label>
            <input
              name="price" type="number" min="0" step="0.01" value={form.price} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock (in {form.unit || 'units'})
          </label>
          <input
            name="stock" type="number" min="0" step="0.01" value={form.stock} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            name="categoryId" value={form.categoryId} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Photo <span className="text-gray-400">(optional)</span></label>
          <ImageUploader
            value={form.imageUrl}
            onChange={(url) => setForm(prev => ({ ...prev, imageUrl: url }))}
            token={token}
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button" onClick={() => router.back()}
            className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
