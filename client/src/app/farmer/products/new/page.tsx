'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, Sparkles } from 'lucide-react'
import ImageUploader from '@/components/ImageUploader'

interface Category { id: number; name: string }

// Maps category name keywords → produce name keywords (English + Filipino/Tagalog/Bicolano)
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  vegetables: [
    'pechay', 'kangkong', 'sitaw', 'string beans', 'ampalaya', 'bitter gourd', 'okra',
    'talong', 'eggplant', 'kamatis', 'tomato', 'sibuyas', 'onion', 'bawang', 'garlic',
    'luya', 'ginger', 'repolyo', 'cabbage', 'labanos', 'radish', 'patola', 'sayote',
    'chayote', 'kalabasa', 'squash', 'mais', 'corn', 'mustasa', 'mustard', 'spinach',
    'malunggay', 'moringa', 'saluyot', 'pepper', 'sili', 'chili', 'upo', 'bottle gourd',
    'papaya', 'dahon', 'leaf', 'gulay', 'vegetable', 'legume', 'bean', 'pea', 'lentil',
    'broccoli', 'cauliflower', 'carrot', 'karot', 'sibuyas tagalog', 'leek', 'celery',
    'kinchay', 'parsley', 'sweet potato tops', 'camote tops', 'tanglad', 'lemongrass',
    'puso ng saging', 'banana blossom', 'labong', 'bamboo shoot',
  ],
  fruits: [
    'mangga', 'mango', 'saging', 'banana', 'pinya', 'pineapple', 'suha', 'pomelo',
    'dalanghita', 'mandarin', 'dalandan', 'orange', 'kalamansi', 'calamansi', 'lemon',
    'rambutan', 'lanzones', 'langka', 'jackfruit', 'durian', 'atis', 'custard apple',
    'guyabano', 'soursop', 'guava', 'bayabas', 'papaya', 'watermelon', 'pakwan',
    'melon', 'santol', 'buko', 'coconut', 'niyog', 'strawberry', 'grape', 'ubas',
    'avocado', 'abokado', 'pear', 'peras', 'apple', 'mansanas', 'dragon fruit',
    'pitaya', 'marang', 'balimbing', 'starfruit', 'caimito', 'camachile',
  ],
  'root crops': [
    'kamote', 'sweet potato', 'gabi', 'taro', 'ube', 'purple yam', 'cassava', 'kamoteng kahoy',
    'singkamas', 'jicama', 'turnip', 'potato', 'patatas', 'yam', 'tugui', 'arrowroot',
    'araro', 'radish', 'beet', 'beetroot', 'carrot', 'karot', 'parsnip',
  ],
  grains: [
    'palay', 'rice', 'bigas', 'mais', 'corn', 'maize', 'wheat', 'trigo', 'oats',
    'millet', 'sorghum', 'quinoa', 'barley', 'buckwheat', 'rye', 'sago',
  ],
  legumes: [
    'mongo', 'munggo', 'mung bean', 'balatong', 'patani', 'lima bean', 'sitaw', 'string bean',
    'bataw', 'hyacinth bean', 'kadyos', 'pigeon pea', 'garbanzos', 'chickpea',
    'soybean', 'toyo', 'kidney bean', 'black bean', 'red bean', 'lentil',
  ],
  poultry: [
    'manok', 'chicken', 'itlog', 'egg', 'pato', 'duck', 'quail', 'pugo', 'turkey',
    'goose', 'guinea fowl', 'native chicken', 'free range', 'organic egg',
  ],
  livestock: [
    'baboy', 'pig', 'pork', 'baka', 'beef', 'cattle', 'cow', 'carabao', 'kalabaw',
    'kambing', 'goat', 'tupa', 'sheep', 'rabbit', 'kuneho', 'horse', 'kabayo',
  ],
  fish: [
    'bangus', 'milkfish', 'tilapia', 'galunggong', 'mackerel', 'tuna', 'tulingan',
    'tambakol', 'salmon', 'sardine', 'herring', 'lapu-lapu', 'grouper', 'maya-maya',
    'snapper', 'pompano', 'dalag', 'mudfish', 'hito', 'catfish', 'carp', 'carpa',
    'dilis', 'anchovies', 'squid', 'pusit', 'shrimp', 'hipon', 'prawn', 'alimango',
    'crab', 'alimasag', 'tahong', 'mussel', 'talaba', 'oyster', 'halaan', 'clam',
    'suso', 'snail', 'seafood', 'isda', 'fish',
  ],
  herbs: [
    'herba', 'herb', 'basil', 'balanoy', 'oregano', 'thyme', 'rosemary', 'mint',
    'yerba buena', 'peppermint', 'coriander', 'wansuy', 'cilantro', 'parsley',
    'kinchay', 'sage', 'bay leaf', 'laurel', 'tanglad', 'lemongrass', 'pandan',
    'turmeric', 'luyang dilaw', 'ginger', 'luya', 'sambong', 'lagundi', 'tsaang gubat',
  ],
  spices: [
    'paminta', 'pepper', 'luya', 'ginger', 'bawang', 'garlic', 'sibuyas', 'onion',
    'sili', 'chili', 'paprika', 'cumin', 'coriander', 'cinnamon', 'kanela',
    'cloves', 'sinamak', 'anise', 'hanis', 'turmeric', 'curry', 'bay leaf', 'laurel',
    'vanilla', 'mustard', 'star anise', 'cardamom', 'nutmeg',
  ],
  dairy: [
    'gatas', 'milk', 'kesong puti', 'cheese', 'yogurt', 'butter', 'mantequilla',
    'cream', 'condensed', 'evaporated', 'goat milk', 'carabao milk',
  ],
  processed: [
    'vinegar', 'suka', 'cooking oil', 'mantika', 'bagoong', 'shrimp paste',
    'patis', 'fish sauce', 'soy sauce', 'toyo', 'coconut oil', 'langis ng niyog',
    'dried fish', 'tuyo', 'tinapa', 'smoked', 'pickled', 'fermented', 'preserved',
    'jam', 'jelly', 'syrup', 'honey', 'pulot', 'muscovado', 'sugar', 'asukal',
    'flour', 'harina', 'starch', 'gawgaw',
  ],
}

// Maps unit value → produce name keywords that are most naturally sold in that unit
const UNIT_KEYWORDS: Record<string, string[]> = {
  bundle: [
    'pechay', 'kangkong', 'sitaw', 'string bean', 'mustasa', 'mustard', 'malunggay', 'moringa',
    'saluyot', 'camote tops', 'sweet potato tops', 'kinchay', 'parsley', 'coriander', 'wansuy',
    'cilantro', 'tanglad', 'lemongrass', 'pandan', 'oregano', 'basil', 'balanoy', 'mint',
    'yerba buena', 'rosemary', 'thyme', 'sage', 'labong', 'bamboo shoot', 'dahon', 'leaf',
    'herb', 'herba', 'spinach', 'celery', 'leek', 'sibuyas tagalog', 'green onion',
    'puso ng saging', 'banana blossom',
  ],
  kg: [
    'mangga', 'mango', 'saging', 'banana', 'pinya', 'pineapple', 'rambutan', 'lanzones',
    'bayabas', 'guava', 'pakwan', 'watermelon', 'melon', 'strawberry', 'grape', 'ubas',
    'avocado', 'abokado', 'santol', 'balimbing', 'starfruit', 'camachile', 'marang', 'pitaya',
    'dragon fruit', 'kalamansi', 'calamansi', 'lemon', 'dalandan', 'dalanghita', 'mandarin',
    'kamatis', 'tomato', 'sibuyas', 'onion', 'bawang', 'garlic', 'luya', 'ginger',
    'repolyo', 'cabbage', 'labanos', 'radish', 'sayote', 'chayote', 'kalabasa', 'squash',
    'ampalaya', 'bitter gourd', 'talong', 'eggplant', 'okra', 'patola', 'upo', 'bottle gourd',
    'broccoli', 'cauliflower', 'mais', 'corn', 'carrot', 'karot', 'pepper', 'sili', 'chili',
    'kamote', 'sweet potato', 'gabi', 'taro', 'ube', 'cassava', 'kamoteng kahoy', 'singkamas',
    'potato', 'patatas', 'yam', 'tugui', 'beet', 'beetroot', 'parsnip',
    'bangus', 'milkfish', 'tilapia', 'galunggong', 'mackerel', 'tuna', 'tulingan', 'tambakol',
    'salmon', 'sardine', 'herring', 'snapper', 'pompano', 'dalag', 'mudfish', 'hito', 'catfish',
    'carp', 'carpa', 'squid', 'pusit', 'shrimp', 'hipon', 'prawn', 'alimango', 'crab',
    'alimasag', 'tahong', 'mussel', 'talaba', 'oyster', 'halaan', 'clam', 'isda', 'fish',
    'baboy', 'pig', 'pork', 'baka', 'beef', 'kambing', 'goat', 'tupa', 'sheep',
    'mongo', 'munggo', 'mung bean', 'balatong', 'patani', 'lima bean', 'bataw', 'kadyos',
    'garbanzos', 'chickpea', 'soybean', 'kidney bean', 'black bean', 'red bean', 'lentil',
    'muscovado', 'sugar', 'asukal', 'flour', 'harina', 'starch', 'gawgaw',
    'turmeric', 'luyang dilaw', 'dried fish', 'tuyo', 'tinapa', 'bagoong',
  ],
  piece: [
    'buko', 'coconut', 'niyog', 'langka', 'jackfruit', 'suha', 'pomelo', 'durian',
    'atis', 'custard apple', 'guyabano', 'soursop', 'papaya', 'pear', 'peras',
    'apple', 'mansanas', 'caimito', 'manok', 'chicken', 'pato', 'duck', 'turkey',
    'lapu-lapu', 'grouper', 'maya-maya', 'kesong puti', 'cheese',
  ],
  tray: [
    'itlog', 'egg', 'pugo', 'quail egg', 'native egg', 'organic egg', 'duck egg', 'pato egg',
  ],
  dozen: [
    'itlog', 'egg', 'kalamansi', 'calamansi', 'quail egg', 'pugo',
  ],
  sack: [
    'palay', 'rice', 'bigas', 'mais', 'corn', 'maize', 'trigo', 'wheat', 'millet',
    'sorghum', 'barley', 'oats', 'rye', 'sago',
  ],
  liter: [
    'gatas', 'milk', 'coconut milk', 'gata', 'goat milk', 'carabao milk',
    'cooking oil', 'mantika', 'coconut oil', 'langis ng niyog', 'langis',
  ],
  bottle: [
    'vinegar', 'suka', 'sinamak', 'patis', 'fish sauce', 'soy sauce', 'toyo',
    'cooking oil', 'mantika', 'coconut oil', 'langis', 'syrup', 'honey', 'pulot',
    'jam', 'jelly', 'hot sauce', 'oyster sauce',
  ],
  gram: [
    'paminta', 'pepper', 'paprika', 'cumin', 'coriander', 'cinnamon', 'kanela',
    'cloves', 'anise', 'hanis', 'star anise', 'cardamom', 'nutmeg', 'curry',
    'vanilla', 'dried herb', 'dried spice', 'powder', 'pulbos',
  ],
  pack: [
    'dried', 'smoked', 'tinapa', 'tuyo', 'dried fish', 'pickled', 'fermented', 'preserved',
    'processed', 'instant', 'mixed', 'seasoning', 'spice mix',
  ],
}

function suggestUnit(name: string): string | null {
  if (!name.trim()) return null
  const lower = name.toLowerCase()

  let bestUnit: string | null = null
  let bestScore = 0

  for (const [unit, keywords] of Object.entries(UNIT_KEYWORDS)) {
    const score = keywords.filter(kw => lower.includes(kw)).length
    if (score > bestScore) { bestScore = score; bestUnit = unit }
  }

  return bestScore > 0 ? bestUnit : null
}

function suggestCategory(name: string, categories: Category[]): Category | null {
  if (!name.trim() || categories.length === 0) return null
  const lower = name.toLowerCase()

  for (const cat of categories) {
    const catKey = cat.name.toLowerCase()
    // Direct category name match wins first
    if (lower.includes(catKey)) return cat
  }

  // Score each category by how many keywords match
  let bestCat: Category | null = null
  let bestScore = 0

  for (const cat of categories) {
    const catKey = Object.keys(CATEGORY_KEYWORDS).find(k =>
      cat.name.toLowerCase().includes(k) || k.includes(cat.name.toLowerCase())
    )
    if (!catKey) continue
    const keywords = CATEGORY_KEYWORDS[catKey]
    const score = keywords.filter(kw => lower.includes(kw)).length
    if (score > bestScore) { bestScore = score; bestCat = cat }
  }

  return bestScore > 0 ? bestCat : null
}

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
    const suggested = suggestCategory(name, cats)
    setSuggestion(suggested)
    setSuggestionDismissed(false)
    const suggestedUnit = suggestUnit(name)
    setUnitSuggestion(suggestedUnit)
    setUnitSuggestionDismissed(false)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))

    if (name === 'name') {
      runSuggestion(value, categories)
    }
    if (name === 'categoryId') {
      setSuggestion(null)
      setSuggestionDismissed(true)
    }
    if (name === 'unit') {
      setUnitSuggestion(null)
      setUnitSuggestionDismissed(true)
    }
  }

  function applySuggestion() {
    if (!suggestion) return
    setForm((prev) => ({ ...prev, categoryId: String(suggestion.id) }))
    setSuggestion(null)
    setSuggestionDismissed(true)
  }

  function dismissSuggestion() {
    setSuggestion(null)
    setSuggestionDismissed(true)
  }

  function applyUnitSuggestion() {
    if (!unitSuggestion) return
    setForm((prev) => ({ ...prev, unit: unitSuggestion }))
    setUnitSuggestion(null)
    setUnitSuggestionDismissed(true)
  }

  function dismissUnitSuggestion() {
    setUnitSuggestion(null)
    setUnitSuggestionDismissed(true)
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
              <div className="mb-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <Sparkles size={13} className="text-green-600 shrink-0" />
                <span className="text-xs text-green-800 flex-1">
                  Suggested: <strong>{unitSuggestion}</strong>
                </span>
                <button
                  type="button"
                  onClick={applyUnitSuggestion}
                  className="text-xs font-semibold text-green-700 hover:text-green-900 border border-green-300 rounded px-2 py-0.5 transition-colors"
                >
                  Apply
                </button>
                <button
                  type="button"
                  onClick={dismissUnitSuggestion}
                  className="text-xs text-green-500 hover:text-green-700 transition-colors"
                  aria-label="Dismiss unit suggestion"
                >
                  ✕
                </button>
              </div>
            )}
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
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Category</label>
          </div>

          {showSuggestion && (
            <div className="mb-2 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <Sparkles size={13} className="text-green-600 shrink-0" />
              <span className="text-xs text-green-800 flex-1">
                Suggested: <strong>{suggestion.name}</strong>
              </span>
              <button
                type="button"
                onClick={applySuggestion}
                className="text-xs font-semibold text-green-700 hover:text-green-900 border border-green-300 rounded px-2 py-0.5 transition-colors"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={dismissSuggestion}
                className="text-xs text-green-500 hover:text-green-700 transition-colors"
                aria-label="Dismiss suggestion"
              >
                ✕
              </button>
            </div>
          )}

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
            {submitting ? 'Saving…' : 'Create Product'}
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
