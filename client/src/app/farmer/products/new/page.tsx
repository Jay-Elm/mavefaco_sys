'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Sparkles } from 'lucide-react'
import ImageUploader from '@/components/ImageUploader'
import { suggestCategory, suggestUnit } from '@/lib/productSuggestions'

interface Category { id: number; name: string }

export default function NewProductPage() {
  const { token } = useAuth()
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [suggestion, setSuggestion] = useState<Category | null>(null)
  const [suggestionDismissed, setSuggestionDismissed] = useState(false)
  const [unitSuggestion, setUnitSuggestion] = useState<string | null>(null)
  const [unitSuggestionDismissed, setUnitSuggestionDismissed] = useState(false)

  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '', unit: 'piece', categoryId: '', imageUrl: '',
  })

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCategories(data))
  }, [])

  const runSuggestion = useCallback((name: string, cats: Category[]) => {
    setSuggestion(suggestCategory(name, cats))
    setSuggestionDismissed(false)
    setUnitSuggestion(suggestUnit(name))
    setUnitSuggestionDismissed(false)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (name === 'name') runSuggestion(value, categories)
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
      const res = await fetch('/api/products', {
        method: 'POST',
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
      if (!res.ok) { setError(data.error ?? 'Failed to create product'); return }
      router.push('/farmer/products')
    } catch {
      setError('Request failed')
    } finally {
      setSubmitting(false)
    }
  }

  const showSuggestion = suggestion !== null && !suggestionDismissed
  const showUnitSuggestion = unitSuggestion !== null && !unitSuggestionDismissed && unitSuggestion !== form.unit

  const SuggestionBanner = ({ label, onApply, onDismiss }: { label: string; onApply: () => void; onDismiss: () => void }) => (
    <div className="mb-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
      <Sparkles size={13} className="text-green-600 shrink-0" />
      <span className="text-xs text-green-800 flex-1">Suggested: <strong>{label}</strong></span>
      <button type="button" onClick={onApply} className="text-xs font-semibold text-green-700 hover:text-green-900 border border-green-300 rounded px-2 py-0.5 transition-colors">Apply</button>
      <button type="button" onClick={onDismiss} className="text-xs text-green-500 hover:text-green-700 transition-colors" aria-label="Dismiss">✕</button>
    </div>
  )

  return (
    <div className="p-4 sm:p-8 max-w-xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Add Product</h1>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            name="name" value={form.name} onChange={handleChange} required
            placeholder="e.g. Pechay, Sweet Potato, Bangus"
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
            className="inline-flex items-center gap-2 px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 transition-colors disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? 'Saving…' : 'Create Product'}
          </button>
          <button type="button" onClick={() => router.back()}
            className="px-5 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
