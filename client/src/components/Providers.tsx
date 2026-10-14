'use client'

import { AuthProvider } from '@/contexts/AuthContext'
import { CartProvider } from '@/contexts/CartContext'
import { DialogProvider } from '@/contexts/DialogContext'

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <CartProvider>
        <DialogProvider>{children}</DialogProvider>
      </CartProvider>
    </AuthProvider>
  )
}
