'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Ban, Trash2 } from 'lucide-react'
import ImageUploader from '@/components/ImageUploader'
import SuggestionBanner from '@/components/SuggestionBanner'
import { suggestCategory, suggestUnit } from '@/lib/productSuggestions'
import { reasonLabels, suspensionDeadline } from '@/validators/productSuspension'
import { useDialog } from '@/contexts/DialogContext'

interface Suspension { suspendedAt: string; reasons: string[]; note: string | null }

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })

interface Category { id: number; name: string }

export default function EditProductPage() {
  const { token } = useAuth()
  const dialog = useDialog()
  const router = useRouter()
  const params = useParams()
  const productId = params.id as string

  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [suspension, setSuspension] = useState<Suspension | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '', unit: 'piece', categoryId: '', imageUrl: '',
  })

  const [suggestion, setSuggestion] = useState<Category | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [unitSuggestion, setUnitSuggestion] = useState<string | null>(null)
  const [unitSuggestionDismissed, setUnitSuggestionDismissed] = useState(false)

  useEffect(() => {
    if (!token) return
    Promise.all([
      fetch(`/api/products/${productId}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ]).then(([product, cats]) => {
      if (product.error) { setError(product.error); return }
      if (product.suspendedAt)
        setSuspension({ suspendedAt: product.suspendedAt, reasons: product.suspensionReasons, note: product.suspensionNote })
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
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'name') {
      setSuggestion(suggestCategory(value, categories))
      setSuggestionDismissed(false)
      setUnitSuggestion(suggestUnit(value))
      setUnitSuggestionDismissed(false)
    }
    if (name === 'categoryId') { setSuggestion(null); setSuggestionDismissed(true) }
    if (name === 'unit') { setUnitSuggestion(null); setUnitSuggestionDismissed(true) }
  }

  function applySuggestion() {
    if (!suggestion) return
    setForm((prev) => ({ ...prev, categoryId: String(suggestion.id) }))
    setSuggestion(null); setSuggestionDismissed(true)
  }

  function applyUnitSuggestion() {
    if (!unitSuggestion) return
    setForm((prev) => ({ ...prev, unit: unitSuggestion }))
    setUnitSuggestion(null); setUnitSuggestionDismissed(true)
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
      // Saving a suspended listing only resubmits it when something customers
      // see changed; otherwise it stays suspended.
      if (data.suspendedAt) {
        setError('Your listing is still suspended. Change the details staff flagged, then save to resubmit it for review.')
        return
      }
      router.push('/farmer/products')
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!token) return
    if (!(await dialog.confirm({ title: `Delete "${form.name}"?`, message: 'It will disappear from the shop. If it has past orders or reviews it is archived so order history stays intact; otherwise it is deleted. This cannot be undone.', confirmLabel: 'Delete listing', tone: 'danger' }))) return
    setError('')
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to delete product'); return }
      router.push('/farmer/products')
    } catch {
      setError('Request failed')
    } finally {
      setDeleting(false)
    }
  }

  const showSuggestion = suggestion !== null && !suggestionDismissed
  const showUnitSuggestion = unitSuggestion !== null && !unitSuggestionDismissed && unitSuggestion !== form.unit

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <h1 className="font-serif text-2xl font-bold text-gray-900 mb-6">Edit Product</h1>

      {suspension && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
          <p className="flex items-center gap-2 font-semibold"><Ban size={15} /> This listing was suspended by MaVeFaCo staff</p>
          <ul className="list-disc ml-6 mt-2 space-y-0.5">
            {reasonLabels(suspension.reasons).map((r) => <li key={r}>{r}</li>)}
          </ul>
          {suspension.note && <p className="mt-2">Note from staff: {suspension.note}</p>}
          <p className="mt-2">
            Fix these details and save to resubmit it for review, or delete it. If it isn&apos;t resubmitted by{' '}
            <span className="font-semibold">{fmtDate(suspensionDeadline(suspension.suspendedAt))}</span>, it will be deleted automatically.
          </p>
        </div>
      )}

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
          <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
          <textarea
            name="description" value={form.description} onChange={handleChange} rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            {showUnitSuggestion && (
              <SuggestionBanner label={unitSuggestion!} onApply={applyUnitSuggestion} onDismiss={() => { setUnitSuggestion(null); setUnitSuggestionDismissed(true) }} />
            )}
            <select
              name="unit" value={form.unit} onChange={handleChange} required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="piece">piece</option>
              <option value="kg">kg</option>
              <option value="gram">gram</option>
              <option value="bundle">bundle</option>
              <option value="pack">pack</option>
              <option value="bag">bag</option>
              <option value="tray">tray</option>
              <option value="dozen">dozen</option>
              <option value="liter">liter</option>
              <option value="sack">sack</option>
              <option value="bottle">bottle</option>
            </select>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Stock (in {form.unit || 'units'})</label>
          <input
            name="stock" type="number" min="0" step="0.01" value={form.stock} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          {showSuggestion && (
            <SuggestionBanner label={suggestion!.name} onApply={applySuggestion} onDismiss={() => { setSuggestion(null); setSuggestionDismissed(true) }} />
          )}
          <select
            name="categoryId" value={form.categoryId} onChange={handleChange} required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Select a category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Product Photo <span className="text-gray-400">(optional)</span></label>
          <ImageUploader value={form.imageUrl} onChange={(url) => setForm(prev => ({ ...prev, imageUrl: url }))} token={token} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2 bg-forest text-white text-sm font-medium rounded-lg hover:bg-forest-mid transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Saving…' : suspension ? 'Save & Resubmit' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button type="button" onClick={handleDelete} disabled={deleting}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60"
          >
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </form>
    </div>
  )
}
