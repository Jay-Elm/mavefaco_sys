'use client'

/**
 * A crop's average selling price per kilo on the marketplace, month by
 * month: one series, so no legend; the title names it. Hovering a point
 * shows its month, price and kilos; a hidden table carries the same numbers
 * for screen readers.
 */
export interface PricePoint { month: string; pricePerKg: number; kg: number }

// Validated against the page surface (dataviz validate_palette: chroma and contrast pass).
const LINE = '#2f8a43'
const W = 600
const H = 170
const PAD = { top: 16, right: 56, bottom: 26, left: 44 }

const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' })
const peso = (n: number) => `₱${n.toFixed(2)}`

export default function PriceTrend({ months, points, title }: { months: string[]; points: PricePoint[]; title: string }) {
  if (points.length === 0) return <p className="text-xs text-gray-500">No kilo sales in the last 12 months.</p>

  const max = Math.max(...points.map((p) => p.pricePerKg)) * 1.15
  const x = (m: string) => PAD.left + (months.indexOf(m) / Math.max(1, months.length - 1)) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom)
  const grid = [0, 0.5, 1].map((f) => max * f)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p.pricePerKg).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <figure className="w-full">
      <figcaption className="text-xs font-semibold text-gray-700 mb-1">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`${title}. Latest ${peso(last.pricePerKg)} per kg in ${monthLabel(last.month)}.`}>
        {grid.map((g) => (
          <g key={g}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(g)} y2={y(g)} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(g) + 4} textAnchor="end" fontSize={11} fill="#6b7280">₱{Math.round(g)}</text>
          </g>
        ))}
        {months.map((m, i) => (i % 2 === months.length % 2 ? null : (
          <text key={m} x={x(m)} y={H - 8} textAnchor="middle" fontSize={11} fill="#6b7280">{monthLabel(m)}</text>
        )))}
        {points.length > 1 && <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {points.map((p) => (
          <g key={p.month}>
            <circle cx={x(p.month)} cy={y(p.pricePerKg)} r={4} fill={LINE} stroke="#fff" strokeWidth={2} />
            {/* A wider invisible target for the hover tooltip. */}
            <circle cx={x(p.month)} cy={y(p.pricePerKg)} r={12} fill="transparent">
              <title>{`${monthLabel(p.month)} ${p.month.slice(0, 4)}: ${peso(p.pricePerKg)} per kg (${p.kg} kg sold)`}</title>
            </circle>
          </g>
        ))}
        <text x={x(last.month) + 8} y={y(last.pricePerKg) + 4} fontSize={11} fill="#374151">{peso(last.pricePerKg)}</text>
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead><tr><th>Month</th><th>Price per kg</th><th>Kilos sold</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.month}><td>{p.month}</td><td>{peso(p.pricePerKg)}</td><td>{p.kg}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
