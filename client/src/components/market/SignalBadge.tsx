import { AlertTriangle, ArrowUpRight, CircleDashed, Equal, Minus, Package } from 'lucide-react'
import { SIGNAL_LABELS, type Signal } from '@/lib/market'

// Each signal carries an icon and its words, never color alone.
const STYLE: Record<Signal, { cls: string; Icon: typeof Equal }> = {
  'demand-above-supply': { cls: 'bg-shoot text-paddy-deep', Icon: ArrowUpRight },
  balanced: { cls: 'bg-gray-100 text-gray-700', Icon: Equal },
  oversupply: { cls: 'bg-amber-100 text-amber-800', Icon: AlertTriangle },
  'no-recent-demand': { cls: 'bg-gray-100 text-gray-600', Icon: Minus },
  'other-units': { cls: 'bg-gray-100 text-gray-600', Icon: Package },
  'not-enough-data': { cls: 'bg-white text-gray-500 border border-gray-200', Icon: CircleDashed },
}

export default function SignalBadge({ signal }: { signal: Signal }) {
  const { cls, Icon } = STYLE[signal]
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      <Icon size={12} aria-hidden /> {SIGNAL_LABELS[signal]}
    </span>
  )
}
