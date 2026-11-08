import Link from 'next/link'
import type { ReactNode } from 'react'

export interface LegalSection {
  id: string
  title: string
  body: ReactNode
}

/** The date both documents took effect; change it with every revision. */
export const LEGAL_EFFECTIVE_DATE = '9 November 2026'
export const COOPERATIVE_EMAIL = 'mavefaco@gmail.com'

/**
 * Layout for the Terms of Service and Privacy Policy: a title band, the
 * effective date, a contents list (beside the text on wide screens) and
 * numbered sections.
 */
export default function LegalPage({
  title,
  intro,
  sections,
  other,
}: {
  title: string
  intro: ReactNode
  sections: LegalSection[]
  /** The companion document, linked at the top and bottom. */
  other: { href: string; label: string }
}) {
  return (
    <div className="bg-field">
      <section className="bg-soil text-white">
        <div className="max-w-[1100px] mx-auto px-6 py-12 lg:py-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-calamansi">MaVeFaCo Marketplace</p>
          <h1 className="mt-2 font-display text-5xl sm:text-6xl font-extrabold leading-none">{title}</h1>
          <p className="mt-4 text-white/75">
            Effective {LEGAL_EFFECTIVE_DATE} · Mayon Vegetable Farmers Agriculture Cooperative, Tabaco City, Albay
          </p>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-6 py-10 lg:py-14 lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        <nav aria-label="On this page" className="mb-8 lg:mb-0">
          <div className="lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">On this page</p>
            <ol className="space-y-2 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-soil/80 hover:text-paddy hover:underline">
                    {i + 1}. {s.title}
                  </a>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm">
              <Link href={other.href} className="font-medium text-paddy hover:underline">{other.label} →</Link>
            </p>
          </div>
        </nav>

        <article className="legal bg-white rounded-card border border-gray-200 shadow-sm px-6 py-8 sm:px-10 sm:py-10 text-[15px] leading-relaxed text-gray-800">
          <div className="text-base text-gray-700">{intro}</div>
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} className="scroll-mt-24 mt-10 first-of-type:mt-8">
              <h2 className="font-display text-2xl font-bold text-soil mb-3">
                {i + 1}. {s.title}
              </h2>
              {s.body}
            </section>
          ))}
          <p className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500">
            Questions about this document? Email{' '}
            <a href={`mailto:${COOPERATIVE_EMAIL}`} className="text-paddy hover:underline">{COOPERATIVE_EMAIL}</a>. See also our{' '}
            <Link href={other.href} className="text-paddy hover:underline">{other.label}</Link>.
          </p>
        </article>
      </div>
    </div>
  )
}

/** A simple bordered table for the legal pages. */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-field text-left text-soil">
          <tr>{head.map((h) => <th key={h} scope="col" className="px-4 py-2.5 font-semibold">{h}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100 align-top">
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} className={`px-4 py-2.5 ${j === 0 ? 'font-medium text-soil' : 'text-gray-700'}`}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
