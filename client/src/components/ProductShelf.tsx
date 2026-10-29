'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ProductCard, { type Product } from '@/components/ProductCard'

/**
 * One category's newest products in a row that scrolls sideways, standing on
 * a crate-coloured plank like produce on a market shelf. Phones swipe; wider
 * screens also get arrow buttons. "See all" opens the category on the
 * products page.
 */
export default function ProductShelf({
  id,
  title,
  total,
  href,
  products,
}: {
  id: string
  title: string
  total: number
  href: string
  products: Product[]
}) {
  const rowRef = useRef<HTMLUListElement>(null)
  const [canBack, setCanBack] = useState(false)
  const [canForward, setCanForward] = useState(false)

  const update = useCallback(() => {
    const row = rowRef.current
    if (!row) return
    setCanBack(row.scrollLeft > 4)
    setCanForward(row.scrollLeft + row.clientWidth < row.scrollWidth - 4)
  }, [])

  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [update])

  const scroll = (dir: -1 | 1) => {
    const row = rowRef.current
    if (!row) return
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    row.scrollBy({ left: dir * row.clientWidth * 0.85, behavior: smooth ? 'smooth' : 'auto' })
  }

  const more = total - products.length
  const arrow =
    'w-9 h-9 rounded-full border border-gray-300 flex items-center justify-center text-soil hover:border-paddy hover:text-paddy transition-colors disabled:opacity-30 disabled:hover:border-gray-300 disabled:hover:text-soil'

  return (
    <section aria-labelledby={`${id}-title`} className="py-6">
      <div className="flex items-end justify-between gap-4 mb-4">
        <h2 id={`${id}-title`} className="font-display text-3xl sm:text-4xl font-bold leading-none">
          {title}
          <span className="ml-3 font-sans text-sm font-medium text-gray-500 tabular">{total}</span>
        </h2>
        <div className="flex items-center gap-3 shrink-0">
          <Link href={href} className="text-sm font-semibold text-paddy hover:underline">
            See all
          </Link>
          {(canBack || canForward) && (
            <div className="hidden sm:flex gap-2">
              <button type="button" onClick={() => scroll(-1)} disabled={!canBack} className={arrow} aria-label={`Scroll ${title} back`}>
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => scroll(1)} disabled={!canForward} className={arrow} aria-label={`Scroll ${title} forward`}>
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bleeds to the screen edge on phones so the next card peeks in. */}
      <ul
        ref={rowRef}
        onScroll={update}
        className="-mx-6 px-6 sm:mx-0 sm:px-0 flex gap-3 sm:gap-4 overflow-x-auto snap-x snap-mandatory scroll-px-6 sm:scroll-px-0 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {products.map((p) => (
          <li key={p.id} className="snap-start shrink-0 w-[44%] sm:w-[220px] lg:w-[228px] flex">
            <div className="w-full flex [&>article]:w-full">
              <ProductCard product={p} size="medium" showCategory={false} />
            </div>
          </li>
        ))}
        {more > 0 && (
          <li className="snap-start shrink-0 w-[44%] sm:w-[220px] lg:w-[228px] flex">
            <Link
              href={href}
              className="w-full rounded-card border-2 border-dashed border-soil/25 bg-[#E6DAC2]/40 flex flex-col items-center justify-center text-center p-4 hover:border-paddy hover:text-paddy transition-colors"
            >
              <span className="font-display text-3xl font-bold leading-none">+{more}</span>
              <span className="mt-2 text-sm font-medium">See all {total} in {title}</span>
            </Link>
          </li>
        )}
      </ul>
      {/* The shelf plank. */}
      <div aria-hidden="true" className="h-2 rounded-full bg-[#E6DAC2]" />
    </section>
  )
}
