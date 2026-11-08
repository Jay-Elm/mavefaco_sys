import type { ReactNode } from 'react'

/**
 * Shows a short label above an icon on hover or keyboard focus (quicker
 * than the browser's own title tooltip). The icon itself still needs an
 * aria-label for screen readers. `align="end"` keeps the label inside the
 * right edge of a table.
 */
export default function Tip({ label, align = 'center', children }: { label: string; align?: 'center' | 'end'; children: ReactNode }) {
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full mb-1.5 z-20 whitespace-nowrap rounded-md bg-soil px-2 py-1 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${
          align === 'end' ? 'right-0' : 'left-1/2 -translate-x-1/2'
        }`}
      >
        {label}
      </span>
    </span>
  )
}
