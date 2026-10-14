'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import { DialogProvider } from '@/contexts/DialogContext'
import type { SessionUser } from '@/lib/serverSession'

export default function Providers({ children, initialUser }: { children: React.ReactNode; initialUser: SessionUser | null }) {
  return (
    <AuthProvider initialUser={initialUser}>
      <CartProvider>
        <DialogProvider>{children}</DialogProvider>
      </CartProvider>
    </AuthProvider>
  )
}
