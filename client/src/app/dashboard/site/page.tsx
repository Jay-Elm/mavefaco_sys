'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  Loader2, Plus, Trash2, AlertCircle, Save, Globe,
  Image as ImageIcon, HelpCircle, Info,
} from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────

interface Banner {
  id: number
  title: string
  subtitle: string | null
  ctaText: string | null
  ctaLink: string | null
  color: string
  active: boolean
  displayOrder: number
}

interface Faq {
  id: number
  question: string
  answer: string
  displayOrder: number
}

type SiteInfo = Record<string, string>

// ── Color config ─────────────────────────────────────────────────────────────

const COLORS: Record<string, { label: string; preview: string }> = {
  green:  { label: 'Green',  preview: 'bg-green-600' },
  orange: { label: 'Orange', preview: 'bg-orange-500' },
  blue:   { label: 'Blue',   preview: 'bg-blue-600' },
  purple: { label: 'Purple', preview: 'bg-purple-600' },
  teal:   { label: 'Teal',   preview: 'bg-teal-600' },
}

const BANNER_BG: Record<string, string> = {
  green:  'bg-gradient-to-r from-green-600 to-green-800',
  orange: 'bg-gradient-to-r from-orange-500 to-orange-700',
  blue:   'bg-gradient-to-r from-blue-600 to-blue-800',
  purple: 'bg-gradient-to-r from-purple-600 to-purple-800',
  teal:   'bg-gradient-to-r from-teal-600 to-teal-800',
}

// ── Shared input class ────────────────────────────────────────────────────────

const INPUT = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

// ── Main component ────────────────────────────────────────────────────────────

type Tab = 'banners' | 'info' | 'faqs'

export default function SitePage() {
  const { token } = useAuth()
  const [tab, setTab] = useState<Tab>('banners')

  return (
    <div className="p-4 sm:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Globe size={22} className="text-green-700" />
        <h1 className="text-2xl font-bold text-gray-900">Site Content</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: 'banners', label: 'Banners', icon: ImageIcon },
          { key: 'info',    label: 'Cooperative Info', icon: Info },
          { key: 'faqs',    label: 'FAQs', icon: HelpCircle },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === key
                ? 'border-green-600 text-green-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'banners' && <BannersTab token={token} />}
      {tab === 'info'    && <InfoTab    token={token} />}
      {tab === 'faqs'    && <FaqsTab    token={token} />}
    </div>
  )
}

// ── Banners Tab ───────────────────────────────────────────────────────────────

function BannersTab({ token }: { token: string | null }) {
  const [banners, setBanners] = useState<Banner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  const [title, setTitle]         = useState('')
  const [subtitle, setSubtitle]   = useState('')
  const [ctaText, setCtaText]     = useState('')
  const [ctaLink, setCtaLink]     = useState('')
  const [color, setColor]         = useState('green')
  const [order, setOrder]         = useState('0')
  const [posting, setPosting]     = useState(false)
  const [postErr, setPostErr]     = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [togglingId, setTogglingId] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/banners', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setBanners(data)
      })
      .catch(() => setError('Failed to load banners'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !token) return
    setPosting(true); setPostErr('')
    try {
      const res = await fetch('/api/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title, subtitle, ctaText, ctaLink, color, displayOrder: Number(order) }),
      })
      const data = await res.json()
      if (!res.ok) { setPostErr(data.error); return }
      setBanners((prev) => [...prev, data].sort((a, b) => a.displayOrder - b.displayOrder))
      setTitle(''); setSubtitle(''); setCtaText(''); setCtaLink(''); setColor('green'); setOrder('0')
    } catch { setPostErr('Failed to add banner') }
    finally { setPosting(false) }
  }

  async function toggleActive(banner: Banner) {
    if (!token) return
    setTogglingId(banner.id)
    try {
      const res = await fetch(`/api/banners/${banner.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ active: !banner.active }),
      })
      const data = await res.json()
      if (res.ok) setBanners((prev) => prev.map((b) => b.id === banner.id ? data : b))
    } catch {}
    finally { setTogglingId(null) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this banner?') || !token) return
    setDeletingId(id)
    try {
      await fetch(`/api/banners/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setBanners((prev) => prev.filter((b) => b.id !== id))
    } catch {}
    finally { setDeletingId(null) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Plus size={14} /> Add Banner
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title *" className={INPUT} />
            <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle (optional)" className={INPUT} />
            <input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Button label (e.g. Shop Now)" className={INPUT} />
            <input value={ctaLink} onChange={(e) => setCtaLink(e.target.value)} placeholder="Button link (e.g. /products)" className={INPUT} />
          </div>
          <div className="flex gap-3 items-center">
            <div className="flex gap-2 items-center flex-1">
              {Object.entries(COLORS).map(([key, { label, preview }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setColor(key)}
                  title={label}
                  className={`w-7 h-7 rounded-full ${preview} transition-all ${color === key ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'opacity-70 hover:opacity-100'}`}
                />
              ))}
              <span className="text-xs text-gray-500 ml-1">Color: {COLORS[color]?.label}</span>
            </div>
            <input
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              type="number"
              placeholder="Order"
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={posting || !title.trim()}
              className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
          {postErr && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} />{postErr}</p>}
        </form>
      </div>

      {/* Banner list */}
      {banners.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ImageIcon size={36} className="mx-auto mb-3" />
          <p>No banners yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div key={b.id} className={`rounded-xl overflow-hidden border border-gray-200 shadow-sm ${!b.active ? 'opacity-50' : ''}`}>
              <div className={`${BANNER_BG[b.color] ?? BANNER_BG.green} text-white px-5 py-4`}>
                <p className="font-bold">{b.title}</p>
                {b.subtitle && <p className="text-sm opacity-80 mt-0.5">{b.subtitle}</p>}
                {b.ctaText && <span className="mt-2 inline-block bg-white/20 text-xs px-3 py-1 rounded-full">{b.ctaText} → {b.ctaLink}</span>}
              </div>
              <div className="bg-white px-5 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">Order: {b.displayOrder} · {b.active ? 'Visible' : 'Hidden'}</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleActive(b)}
                    disabled={togglingId === b.id}
                    className="text-xs px-3 py-1 rounded-full border transition-colors disabled:opacity-40 border-gray-300 hover:border-green-500 hover:text-green-700"
                  >
                    {togglingId === b.id ? <Loader2 size={12} className="animate-spin inline" /> : b.active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    disabled={deletingId === b.id}
                    className="p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                  >
                    {deletingId === b.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Info Tab ──────────────────────────────────────────────────────────────────

const INFO_FIELDS = [
  { key: 'cooperative_name', label: 'Cooperative Name', placeholder: 'e.g. CoopMarket Farmers Cooperative' },
  { key: 'about_text',       label: 'About',            placeholder: 'Describe the cooperative…', multiline: true },
  { key: 'mission',          label: 'Mission',          placeholder: 'Our mission…', multiline: true },
  { key: 'vision',           label: 'Vision',           placeholder: 'Our vision…', multiline: true },
  { key: 'contact_email',    label: 'Contact Email',    placeholder: 'info@coopmarket.ph' },
  { key: 'contact_phone',    label: 'Contact Phone',    placeholder: '+63 912 345 6789' },
  { key: 'contact_address',  label: 'Address',          placeholder: 'Barangay…, Albay, Philippines' },
  { key: 'facebook_url',     label: 'Facebook URL',     placeholder: 'https://facebook.com/…' },
]

function InfoTab({ token }: { token: string | null }) {
  const [info, setInfo]     = useState<SiteInfo>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/site-content', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (!data.error) setInfo(data) })
      .catch(() => setError('Failed to load site info'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setSaving(true); setSaved(false); setError('')
    try {
      const res = await fetch('/api/admin/site-content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(info),
      })
      if (res.ok) setSaved(true)
      else setError('Failed to save')
    } catch { setError('Failed to save') }
    finally { setSaving(false) }
  }

  if (loading) return <Spinner />

  return (
    <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4 max-w-2xl">
      {INFO_FIELDS.map(({ key, label, placeholder, multiline }) => (
        <div key={key}>
          <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
          {multiline ? (
            <textarea
              value={info[key] ?? ''}
              onChange={(e) => setInfo((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              rows={3}
              className={`${INPUT} resize-none`}
            />
          ) : (
            <input
              value={info[key] ?? ''}
              onChange={(e) => setInfo((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder={placeholder}
              className={INPUT}
            />
          )}
        </div>
      ))}

      {error && <p className="text-red-500 text-sm">{error}</p>}
      {saved && <p className="text-green-600 text-sm">Saved successfully.</p>}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save Changes
      </button>
    </form>
  )
}

// ── FAQs Tab ──────────────────────────────────────────────────────────────────

function FaqsTab({ token }: { token: string | null }) {
  const [faqs, setFaqs]       = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer]     = useState('')
  const [order, setOrder]       = useState('0')
  const [posting, setPosting]   = useState(false)
  const [postErr, setPostErr]   = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/admin/faqs', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { if (!data.error) setFaqs(data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim() || !answer.trim() || !token) return
    setPosting(true); setPostErr('')
    try {
      const res = await fetch('/api/admin/faqs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, answer, displayOrder: Number(order) }),
      })
      const data = await res.json()
      if (!res.ok) { setPostErr(data.error); return }
      setFaqs((prev) => [...prev, data].sort((a, b) => a.displayOrder - b.displayOrder))
      setQuestion(''); setAnswer(''); setOrder('0')
    } catch { setPostErr('Failed to add FAQ') }
    finally { setPosting(false) }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this FAQ?') || !token) return
    setDeletingId(id)
    try {
      await fetch(`/api/admin/faqs/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
      setFaqs((prev) => prev.filter((f) => f.id !== id))
    } catch {}
    finally { setDeletingId(null) }
  }

  if (loading) return <Spinner />

  return (
    <div className="space-y-6">
      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Plus size={14} /> Add FAQ
        </h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Question *" className={INPUT} />
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Answer *"
            rows={3}
            className={`${INPUT} resize-none`}
          />
          {postErr && <p className="text-red-500 text-xs flex items-center gap-1"><AlertCircle size={12} />{postErr}</p>}
          <div className="flex items-center gap-3 justify-end">
            <input
              value={order}
              onChange={(e) => setOrder(e.target.value)}
              type="number"
              placeholder="Order"
              className="w-20 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="submit"
              disabled={posting || !question.trim() || !answer.trim()}
              className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {posting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </form>
      </div>

      {/* FAQ list */}
      {faqs.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <HelpCircle size={36} className="mx-auto mb-3" />
          <p>No FAQs yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {faqs.map((f) => (
            <div key={f.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{f.question}</p>
                  <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{f.answer}</p>
                  <p className="text-xs text-gray-400 mt-1">Order: {f.displayOrder}</p>
                </div>
                <button
                  onClick={() => handleDelete(f.id)}
                  disabled={deletingId === f.id}
                  className="shrink-0 p-1.5 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-40"
                >
                  {deletingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-48 text-gray-400">
      <Loader2 size={28} className="animate-spin" />
    </div>
  )
}
