'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { bannerStyle } from '@/components/bannerStyles'
import { isSafeUrl } from '@/lib/url'

export interface BannerItem {
  id: number
  title: string
  subtitle: string | null
  ctaText: string | null
  ctaLink: string | null
  color: string
}

/** Banners shown before "Show all banners". */
const SHOWN = 2

/** The home page banners, in their set order: the first two, and the rest a click away. */
export default function BannerList({ banners }: { banners: BannerItem[] }) {
  const [expanded, setExpanded] = useState(false)
  if (banners.length === 0) return null
  const visible = expanded ? banners : banners.slice(0, SHOWN)
  const hidden = banners.length - SHOWN

  return (
    <div className="space-y-4">
      {visible.map((b) => {
        const style = bannerStyle(b.color)
        return (
          <div key={b.id} className={`rounded-card px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${style.surface}`}>
            <div>
              <h2 className="font-display text-2xl font-bold leading-tight">{b.title}</h2>
              {b.subtitle && <p className={`text-sm mt-1 ${style.muted}`}>{b.subtitle}</p>}
            </div>
            {b.ctaText && b.ctaLink && isSafeUrl(b.ctaLink) && (
              <Link href={b.ctaLink} className={`shrink-0 inline-flex items-center gap-2 font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm ${style.action}`}>
                {b.ctaText} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
        )
      })}
      {hidden > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1 text-sm font-semibold text-paddy hover:text-paddy-deep"
          >
            {expanded ? (
              <>Show fewer banners <ChevronUp size={14} aria-hidden /></>
            ) : (
              <>Show all banners ({banners.length}) <ChevronDown size={14} aria-hidden /></>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
