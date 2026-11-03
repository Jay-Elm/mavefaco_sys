'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Info, AlertTriangle, Leaf, X, ArrowRight, Megaphone } from 'lucide-react'

export interface AnnouncementItem {
  id: number
  title: string
  body: string
  type: string
  createdAt: string | Date
}

/*
 * Each type gets its own hue, as a left-to-right gradient that fades from
 * 66% to 33% so the sand still shows through: advisory green, alert red,
 * info blue. Text stays dark on all three.
 */
const STYLES = {
  advisory: { label: 'Advisory', icon: Leaf, gradient: 'linear-gradient(to right, rgb(134 239 172 / 0.66), rgb(187 247 208 / 0.33))', border: 'border-green-300/70', chip: 'bg-green-700 text-white' },
  alert: { label: 'Alert', icon: AlertTriangle, gradient: 'linear-gradient(to right, rgb(252 165 165 / 0.66), rgb(254 202 202 / 0.33))', border: 'border-red-300/70', chip: 'bg-red-700 text-white' },
  info: { label: 'Info', icon: Info, gradient: 'linear-gradient(to right, rgb(147 197 253 / 0.66), rgb(191 219 254 / 0.33))', border: 'border-blue-300/70', chip: 'bg-blue-700 text-white' },
} as const

type TypeKey = keyof typeof STYLES
/** Cards shown on a phone; the full `shown` count from the small breakpoint up. */
const PHONE_SHOWN = 2
const styleOf = (type: string) => STYLES[(type in STYLES ? type : 'info') as TypeKey]
const fmtDate = (d: string | Date) => new Date(d).toLocaleDateString('en-PH', { dateStyle: 'medium' })

/**
 * The newest announcements as a grid of same-height cards, with "Read more"
 * on any card whose text doesn't fit and "View all announcements" for the
 * rest (sortable, filterable). Used on the home page and farmer overview.
 */
export default function AnnouncementBoard({
  announcements,
  shown = 4,
  heading = 'Announcements',
}: {
  announcements: AnnouncementItem[]
  /** How many of the newest to show as cards. */
  shown?: number
  heading?: string
}) {
  const [open, setOpen] = useState<AnnouncementItem | null>(null)
  const [showAll, setShowAll] = useState(false)
  if (announcements.length === 0) return null

  const newest = [...announcements]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, shown)
  // More than fit on a phone, or more than the cards on a wider screen.
  const hiddenOnPhone = announcements.length - Math.min(shown, PHONE_SHOWN)

  return (
    <section aria-labelledby="announcements-heading">
      <div className="flex items-end justify-between gap-3 mb-3">
        <h2 id="announcements-heading" className="flex items-center gap-2 font-display text-2xl font-bold leading-none">
          <Megaphone size={18} className="text-paddy" aria-hidden /> {heading}
        </h2>
        {hiddenOnPhone > 0 && (
          <button type="button" onClick={() => setShowAll(true)} className="hidden sm:inline-flex items-center gap-1 text-sm font-semibold text-paddy hover:text-paddy-deep">
            View all announcements ({announcements.length}) <ArrowRight size={14} aria-hidden />
          </button>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {newest.map((a, i) => (
          // Phones show the newest two; the rest are a tap away.
          <div key={a.id} className={`grid ${i >= PHONE_SHOWN ? 'max-sm:hidden' : ''}`}>
            <AnnouncementCard a={a} onOpen={() => setOpen(a)} />
          </div>
        ))}
      </div>

      {hiddenOnPhone > 0 && (
        <button type="button" onClick={() => setShowAll(true)} className="sm:hidden btn btn-outline w-full mt-3">
          View all announcements ({announcements.length})
        </button>
      )}

      {open && (
        <Modal title={open.title} onClose={() => setOpen(null)}>
          <FullAnnouncement a={open} />
        </Modal>
      )}
      {showAll && (
        <Modal title="All announcements" onClose={() => setShowAll(false)} wide>
          <AllAnnouncements announcements={announcements} />
        </Modal>
      )}
    </section>
  )
}

/** A fixed-height card: the text fades out at the bottom when it doesn't fit, with "Read more". */
function AnnouncementCard({ a, onOpen }: { a: AnnouncementItem; onOpen: () => void }) {
  const style = styleOf(a.type)
  const Icon = style.icon
  const bodyRef = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  useLayoutEffect(() => {
    const el = bodyRef.current
    if (!el) return
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [a.body, a.title])

  return (
    <article
      className={`min-h-36 max-h-48 flex flex-col rounded-card border ${style.border} px-5 pt-4 pb-3 shadow-card`}
      style={{ backgroundImage: style.gradient }}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${style.chip}`}>
          <Icon size={11} aria-hidden /> {style.label}
        </span>
        <time className="text-soil/70">{fmtDate(a.createdAt)}</time>
      </div>
      <div
        ref={bodyRef}
        className="mt-2 flex-1 min-h-0 overflow-hidden"
        style={overflows ? { maskImage: 'linear-gradient(to bottom, black 70%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent)' } : undefined}
      >
        <h3 className="font-display text-2xl font-bold leading-tight text-soil">{a.title}</h3>
        <p className="mt-1.5 text-sm text-soil/85 whitespace-pre-wrap">{a.body}</p>
      </div>
      {overflows && (
        <button type="button" onClick={onOpen} className="self-start mt-1 text-sm font-semibold text-soil underline underline-offset-2 hover:text-paddy-deep">
          Read more
        </button>
      )}
    </article>
  )
}

function FullAnnouncement({ a }: { a: AnnouncementItem }) {
  const style = styleOf(a.type)
  const Icon = style.icon
  return (
    <div>
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${style.chip}`}>
          <Icon size={11} aria-hidden /> {style.label}
        </span>
        <time className="text-gray-600">{fmtDate(a.createdAt)}</time>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-soil whitespace-pre-wrap">{a.body}</p>
    </div>
  )
}

type Sort = 'newest' | 'oldest'

/** Every announcement, newest first by default, with a type filter and search. */
function AllAnnouncements({ announcements }: { announcements: AnnouncementItem[] }) {
  const [sort, setSort] = useState<Sort>('newest')
  const [type, setType] = useState<'all' | TypeKey>('all')
  const [query, setQuery] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return announcements
      .filter((a) => type === 'all' || (a.type in STYLES ? a.type : 'info') === type)
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q))
      .sort((a, b) => {
        const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        return sort === 'newest' ? d : -d
      })
  }, [announcements, sort, type, query])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of announcements) {
      const k = a.type in STYLES ? a.type : 'info'
      c[k] = (c[k] ?? 0) + 1
    }
    return c
  }, [announcements])

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search announcements"
          aria-label="Search announcements"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-paddy"
        />
        <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-paddy">
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
        {(['all', 'advisory', 'alert', 'info'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            onClick={() => setType(t)}
            className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
              type === t ? 'bg-soil text-white border-soil' : 'bg-white text-soil border-gray-300 hover:border-soil'
            }`}
          >
            {t === 'all' ? `All (${announcements.length})` : `${STYLES[t].label} (${counts[t] ?? 0})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-gray-600 py-8 text-center">No announcements match.</p>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => {
            const style = styleOf(a.type)
            return (
              <li key={a.id} className={`rounded-card border ${style.border} px-5 py-4`} style={{ backgroundImage: style.gradient }}>
                <h3 className="font-display text-xl font-bold leading-tight text-soil mb-1.5">{a.title}</h3>
                <FullAnnouncement a={a} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** A centred window over a dimmed page; Escape, the X or a click outside closes it. */
function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previous?.focus()
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative bg-[#FBF8F1] w-full ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'} max-h-[88vh] flex flex-col rounded-t-card sm:rounded-card shadow-2xl`}
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-3 border-b border-black/10">
          <h2 className="font-display text-3xl font-bold leading-tight">{title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="shrink-0 p-1 -m-1 text-gray-600 hover:text-soil">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
      </div>
    </div>
  )
}
