'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Minus, ShoppingCart, Package, ArrowLeft, Loader2, Wallet, MapPin, AlertTriangle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'

const PAYMENT_METHODS = [
  { value: 'cod', label: 'Cash on Delivery' },
  { value: 'gcash', label: 'GCash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
]

const DELIVERY_METHODS = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
]

export default function CartPage() {
  const { isAuthenticated, token } = useAuth()
  const { items, cartReady, removeItem, updateQuantity, clearCart, refreshStock, totalAmount } = useCart()
  const router = useRouter()
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState('cod')
  const [deliveryMethod, setDeliveryMethod] = useState('pickup')
  const [stockWarning, setStockWarning] = useState<string | null>(null)
  const [checkingStock, setCheckingStock] = useState(false)
  const stockChecked = useRef(false)

  useEffect(() => {
    if (!cartReady || stockChecked.current || items.length === 0) return
    stockChecked.current = true
    setCheckingStock(true)
    refreshStock().then(({ removed, adjusted }) => {
      const parts: string[] = []
      if (removed.length > 0) parts.push(`${removed.join(', ')} ${removed.length === 1 ? 'is' : 'are'} no longer available and ${removed.length === 1 ? 'was' : 'were'} removed from your cart.`)
      if (adjusted.length > 0) parts.push(`Quantities for ${adjusted.join(', ')} were reduced to match available stock.`)
      if (parts.length > 0) setStockWarning(parts.join(' '))
    }).finally(() => setCheckingStock(false))
  }, [cartReady, items.length])

  async function handleCheckout() {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }
    if (items.length === 0) return

    setPlacing(true)
    setError(null)

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity })),
          paymentMethod,
          deliveryMethod,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to place order')
        return
      }

      clearCart()
      router.push('/customer/orders')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingCart size={56} className="text-gray-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-6">Browse our products and add something you like.</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
        >
          <ArrowLeft size={16} />
          Browse Products
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingCart size={24} />
          Your Cart
        </h1>
        <button
          onClick={clearCart}
          className="text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Clear cart
        </button>
      </div>

      {checkingStock && (
        <div className="mb-4 text-sm text-gray-500 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          Checking stock availability…
        </div>
      )}

      {stockWarning && (
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-4 py-3">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <p>{stockWarning}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">
        {/* Item list */}
        <div className="lg:col-span-2 space-y-4">
          {items.map(item => (
            <div
              key={item.productId}
              className="bg-white border border-gray-200 rounded-2xl p-4 flex gap-4 shadow-sm"
            >
              <div className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill unoptimized className="object-cover" />
                ) : (
                  <Package size={28} className="text-gray-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{item.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">₱{item.price.toFixed(2)} / {item.unit}</p>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => {
                        const step = /kg|kilo|gram|\bg\b|lb|liter|litre|ml/.test(item.unit.toLowerCase()) ? 0.25 : 1
                        updateQuantity(item.productId, parseFloat((item.quantity - step).toFixed(2)))
                      }}
                      className="px-2.5 py-1.5 hover:bg-gray-100 transition-colors text-gray-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-gray-800 border-x border-gray-200">
                      {parseFloat(item.quantity.toFixed(2))}
                    </span>
                    <button
                      onClick={() => {
                        const step = /kg|kilo|gram|\bg\b|lb|liter|litre|ml/.test(item.unit.toLowerCase()) ? 0.25 : 1
                        updateQuantity(item.productId, parseFloat((item.quantity + step).toFixed(2)))
                      }}
                      disabled={item.quantity >= item.stock}
                      className="px-2.5 py-1.5 hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400">
                    of {parseFloat(item.stock.toFixed(2))} {item.unit} available
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end justify-between flex-shrink-0">
                <p className="font-bold text-green-700">₱{(item.price * item.quantity).toFixed(2)}</p>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm sticky top-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>

            <div className="space-y-2 text-sm text-gray-600">
              {items.map(item => (
                <div key={item.productId} className="flex justify-between">
                  <span className="truncate pr-2">{item.name} × {parseFloat(item.quantity.toFixed(2))} {item.unit}</span>
                  <span className="font-medium text-gray-800 flex-shrink-0">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-gray-900">Total</span>
                <span className="text-xl font-bold text-green-700">₱{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Wallet size={14} /> Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {PAYMENT_METHODS.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Delivery method */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <MapPin size={14} /> Delivery Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {DELIVERY_METHODS.map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setDeliveryMethod(m.value)}
                    className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                      deliveryMethod === m.value
                        ? 'bg-green-700 text-white border-green-700'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-green-500'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            {!isAuthenticated && (
              <p className="text-xs text-gray-500 text-center">
                You must be logged in to place an order.
              </p>
            )}

            <button
              onClick={handleCheckout}
              disabled={placing}
              className="w-full bg-green-700 hover:bg-green-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
            >
              {placing && <Loader2 size={16} className="animate-spin" />}
              {placing ? 'Placing Order…' : isAuthenticated ? 'Place Order' : 'Login to Checkout'}
            </button>

            <Link
              href="/products"
              className="block text-center text-sm text-gray-500 hover:text-green-700 transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
