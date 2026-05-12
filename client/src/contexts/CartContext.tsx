'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export interface CartItem {
  productId: number
  name: string
  price: number
  quantity: number
  imageUrl: string | null
  stock: number
  farmerId: number
  farmerName: string
}

interface CartContextType {
  items: CartItem[]
  addItem: (product: Omit<CartItem, 'quantity'>, qty?: number) => 'ok' | 'conflict'
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  totalItems: number
  totalAmount: number
}

const CartContext = createContext<CartContextType | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()

  // Each user gets their own isolated cart key. Guests have no persistent cart.
  const cartKey = user ? `cart_${user.id}` : null

  const [items, setItems] = useState<CartItem[]>([])
  const [loaded, setLoaded] = useState(false)

  // Load the correct cart whenever the authenticated user changes.
  // Wait for auth to finish hydrating first (authLoading) to avoid a
  // guest-cart flash before we know who is logged in.
  useEffect(() => {
    if (authLoading) return
    setLoaded(false)
    if (!cartKey) {
      setItems([])
      setLoaded(true)
      return
    }
    try {
      const stored = localStorage.getItem(cartKey)
      setItems(stored ? JSON.parse(stored) : [])
    } catch {
      setItems([])
    }
    setLoaded(true)
  }, [cartKey, authLoading])

  // Persist cart changes for logged-in users only.
  useEffect(() => {
    if (!loaded || !cartKey) return
    localStorage.setItem(cartKey, JSON.stringify(items))
  }, [items, loaded, cartKey])

  function addItem(product: Omit<CartItem, 'quantity'>, qty: number = 1): 'ok' | 'conflict' {
    const existingFarmerId = items.length > 0 ? (items[0].farmerId ?? null) : null
    if (existingFarmerId !== null && existingFarmerId !== product.farmerId) {
      return 'conflict'
    }
    setItems(prev => {
      const existing = prev.find(i => i.productId === product.productId)
      if (existing) {
        return prev.map(i =>
          i.productId === product.productId
            ? { ...i, quantity: Math.min(i.quantity + qty, product.stock) }
            : i
        )
      }
      return [...prev, { ...product, quantity: Math.min(qty, product.stock) }]
    })
    return 'ok'
  }

  function removeItem(productId: number) {
    setItems(prev => prev.filter(i => i.productId !== productId))
  }

  function updateQuantity(productId: number, quantity: number) {
    if (quantity < 1) { removeItem(productId); return }
    setItems(prev => prev.map(i => (i.productId === productId ? { ...i, quantity } : i)))
  }

  function clearCart() {
    setItems([])
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalAmount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
