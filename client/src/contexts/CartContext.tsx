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
  unit: string
  farmerId: number
  farmerName: string
}

interface StockRefreshResult {
  removed: string[]
  adjusted: string[]
}

interface CartContextType {
  items: CartItem[]
  cartReady: boolean
  addItem: (product: Omit<CartItem, 'quantity'>, qty?: number) => 'ok' | 'conflict'
  removeItem: (productId: number) => void
  updateQuantity: (productId: number, quantity: number) => void
  clearCart: () => void
  refreshStock: () => Promise<StockRefreshResult>
  totalItems: number
  totalAmount: number
}

const CartContext = createContext<CartContextType | null>(null)

function readStoredCart(cartKey: string | null): CartItem[] {
  if (!cartKey) return []
  try {
    const stored = localStorage.getItem(cartKey)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()

  // Each user gets their own isolated cart key. Guests have no persistent cart.
  const cartKey = user ? `cart_${user.id}` : null

  const [items, setItems] = useState<CartItem[]>([])
  // The cart key `items` was loaded for; undefined until the first load.
  const [loadedKey, setLoadedKey] = useState<string | null | undefined>(undefined)

  // Load the correct cart whenever the authenticated user changes.
  // Wait for auth to finish hydrating first (authLoading) to avoid a
  // guest-cart flash before we know who is logged in. Adjusted during
  // render rather than in an effect, so no render ever pairs one user's
  // key with another user's items. authLoading is true for the server
  // render, so localStorage is only read in the browser.
  if (!authLoading && loadedKey !== cartKey) {
    setLoadedKey(cartKey)
    setItems(readStoredCart(cartKey))
  }
  const loaded = !authLoading && loadedKey === cartKey

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
    if (quantity <= 0) { removeItem(productId); return }
    setItems(prev => prev.map(i => (i.productId === productId ? { ...i, quantity } : i)))
  }

  function clearCart() {
    setItems([])
  }

  async function refreshStock(): Promise<StockRefreshResult> {
    if (items.length === 0) return { removed: [], adjusted: [] }

    const snapshot = [...items]
    const results = await Promise.all(
      snapshot.map(async item => {
        try {
          const res = await fetch(`/api/products/${item.productId}`)
          if (!res.ok) return { item, stock: 0, gone: true }
          const data = await res.json()
          return { item, stock: data.stock as number, gone: false }
        } catch {
          return { item, stock: item.stock, gone: false }
        }
      })
    )

    const removed: string[] = []
    const adjusted: string[] = []
    const newItems: CartItem[] = []

    for (const result of results) {
      if (result.gone || result.stock === 0) {
        removed.push(result.item.name)
      } else {
        const newQty = Math.min(result.item.quantity, result.stock)
        if (newQty < result.item.quantity) adjusted.push(result.item.name)
        newItems.push({ ...result.item, stock: result.stock, quantity: newQty })
      }
    }

    setItems(newItems)
    return { removed, adjusted }
  }

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0)
  const totalAmount = items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{ items, cartReady: loaded, addItem, removeItem, updateQuantity, clearCart, refreshStock, totalItems, totalAmount }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
