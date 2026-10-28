'use client'

import { usePathname } from 'next/navigation'

const PUBLIC_PATHS = ['/', '/about']
const PUBLIC_PREFIXES = ['/products', '/sellers']

// The footer is rendered on the server (it reads the cooperative's contact
// details) and passed in; this only decides which pages show it.
export default function ConditionalFooter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const show =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some(p => pathname.startsWith(p))

  return show ? <>{children}</> : null
}
