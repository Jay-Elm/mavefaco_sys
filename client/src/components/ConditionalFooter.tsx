'use client'

import { usePathname } from 'next/navigation'
import Footer from './Footer'

const PUBLIC_PATHS = ['/', '/about']
const PUBLIC_PREFIXES = ['/products', '/sellers']

export default function ConditionalFooter() {
  const pathname = usePathname()

  const show =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  if (!show) return null
  return <Footer />
}
