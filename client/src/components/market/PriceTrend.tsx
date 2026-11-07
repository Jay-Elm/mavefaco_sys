'use client'

/**
 * A crop's price per kilo, month by month: the marketplace's own selling
 * price beside PSA farmgate prices for Albay and the Bicol region. Each
 * line has a legend entry and an end label (and Bicol is dashed), so colour
 * is never the only cue; hovering a point shows its month and price, and a
 * hidden table carries every number for screen readers.
 */
export interface PricePoint { month: string; pricePerKg: number }
export interface PriceSeries { key: string; label: string; short: string; points: PricePoint[] }

// Fixed order, validated together (dataviz validate_palette, light surface: all checks pass).
const STYLE: Record<string, { color: string; dash?: string }> = {
  marketplace: { color: '#2f8a43' },
  albay: { color: '#2a6fdb' },
  bicol: { color: '#c25e0a', dash: '6 4' },
}

const W = 640
const H = 200
const PAD = { top: 16, right: 116, bottom: 26, left: 44 }

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' })
const peso = (n: number) => `₱${n.toFixed(2)}`

export default function PriceTrend({ months, series, title }: { months: string[]; series: PriceSeries[]; title: string }) {
  const shown = series.map((s) => ({ ...s, points: s.points.filter((p) => months.includes(p.month)) })).filter((s) => s.points.length > 0)
  if (shown.length === 0) return <p className="text-xs text-gray-500">No prices for this crop in the last 12 months.</p>

  const max = Math.max(...shown.flatMap((s) => s.points.map((p) => p.pricePerKg))) * 1.15
  const x = (m: string) => PAD.left + (months.indexOf(m) / Math.max(1, months.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const grid = [0, 0.5, 1].map((f) => max * f)

  // End labels, nudged apart so they don't overlap.
  const ends = shown
    .map((s) => ({ key: s.key, label: s.label, short: s.short, last: s.points[s.points.length - 1] }))
    .sort((a, b) => y(a.last.pricePerKg) - y(b.last.pricePerKg))
  let prevY = -Infinity
  const endY = new Map<string, number>()
  for (const e of ends) {
    const yy = Math.max(y(e.last.pricePerKg) + 4, prevY + 13)
    endY.set(e.key, yy)
    prevY = yy
  }

  return (
    <figure className="w-full min-w-0">
      <figcaption className="text-xs font-semibold text-gray-700 mb-1">{title}</figcaption>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mb-1 text-xs text-gray-700" aria-hidden>
        {shown.map((s) => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="18" height="8"><line x1="1" x2="17" y1="4" y2="4" stroke={STYLE[s.key]?.color} strokeWidth="2" strokeDasharray={STYLE[s.key]?.dash} /></svg>
            {s.label}
          </li>
        ))}
      </ul>
      {/* Kept readable on a phone: below 520px wide the chart scrolls sideways. */}
      <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px] h-auto" role="img" aria-label={`${title}. ${ends.map((e) => `${e.label}: ${peso(e.last.pricePerKg)} in ${monthLabel(e.last.month)}`).join('; ')}.`}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(g) + 4} textAnchor="end" fontSize={11} fill="#6b7280">₱{Math.round(g)}</text>
          </g>
        ))}
        {months.map((m, i) => (i % 2 === months.length % 2 ? null : (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b7280">{monthLabel(m)}</text>
        )))}
        {shown.map((s) => {
          const st = STYLE[s.key] ?? { color: '#6b7280' }
          const path = s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p.pricePerKg).toFixed(1)}`).join(' ')
          return (
            <g key={s.key}>
              {s.points.length > 1 && <path d={path} fill="none" stroke={st.color} strokeWidth={2} strokeDasharray={st.dash} strokeLinejoin="round" strokeLinecap="round" />}
              {s.points.map((p) => (
                <g key={p.month}>
                  <circle cx={x(p.month)} cy={y(p.pricePerKg)} r={4} fill={st.color} stroke="#fff" strokeWidth={2} />
                  <circle cx={x(p.month)} cy={y(p.pricePerKg)} r={11} fill="transparent">
                    <title>{`${s.label}, ${monthLabel(p.month)} ${p.month.slice(0, 4)}: ${peso(p.pricePerKg)} per kg`}</title>
                  </circle>
                </g>
              ))}
            </g>
          )
        })}
        {ends.map((e) => (
          <text key={e.key} x={W - PAD.right + 8} y={endY.get(e.key)} fontSize={11} fill="#374151">{e.short} {peso(e.last.pricePerKg)}</text>
        ))}
      </svg>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>Series</th><th>Month</th><th>Price per kg</th></tr></thead>
        <tbody>{shown.flatMap((s) => s.points.map((p) => <tr key={`${s.key}${p.month}`}><td>{s.label}</td><td>{p.month}</td><td>{peso(p.pricePerKg)}</td></tr>))}</tbody>
      </table>
    </figure>
  )
}
