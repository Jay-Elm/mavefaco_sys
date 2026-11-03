'use client'

import { useEffect } from 'react'

/**
 * Browsers change a focused number box when the mouse wheel turns over it,
 * so scrolling the page quietly edits prices and amounts. Letting go of the
 * focus first makes the wheel scroll the page instead, on every page.
 */
export default function NumberWheelGuard() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      const el = e.target
      if (el instanceof HTMLInputElement && el.type === 'number' && document.activeElement === el) el.blur()
    }
    document.addEventListener('wheel', onWheel, { passive: true, capture: true })
    return () => document.removeEventListener('wheel', onWheel, { capture: true })
  }, [])
  return null
}
