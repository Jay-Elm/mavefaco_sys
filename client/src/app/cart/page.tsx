'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Trash2, Plus, Minus, ShoppingCart, Package, ArrowLeft, Loader2, Wallet, MapPin, AlertTriangle, LogIn, UserPlus, X, Info } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useCart } from '@/contexts/CartContext'
import { fmtQty, maxBuyable, unitStep } from '@/lib/units'
import { DELIVERY_AREA_TEXT } from '@/lib/deliveryArea'
import LocationPicker, { type SavedLocation } from '@/components/LocationPicker'

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
  // GCash only when this farmer has set it up (null while checking).
  const [gcashOk, setGcashOk] = useState<boolean | null>(null)
  const [location, setLocation] = useState<SavedLocation | null>(null)
  const [picking, setPicking] = useState(false)
  const farmerId = items[0]?.farmerId

  useEffect(() => {
    if (!token || !farmerId) return
    fetch(`/api/orders/options?farmerId=${farmerId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => {
        setGcashOk(Boolean(d.gcash))
        if (!d.gcash) setPaymentMethod(m => (m === 'gcash' ? 'cod' : m))
      })
      .catch(() => setGcashOk(false))
  }, [token, farmerId])

  useEffect(() => {
    if (!token) return
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (!d.error) setLocation(d) })
      .catch(() => {})
  }, [token])

  const hasSpot = location?.deliveryLat != null && Boolean(location?.deliveryAddress)
  const deliveryBlocked = deliveryMethod === 'delivery' && !(hasSpot && location?.deliveryTown)

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
    // refreshStock changes identity every render; stockChecked keeps this to one run.
  }, [cartReady, items.length, refreshStock])

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

  // Guests have no persistent cart (see CartContext) — items is always []
  // for them, so this is the only place to nudge them toward an account
  // rather than let it look identical to "you have a cart, it's just empty."
  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingCart size={56} className="text-gray-300 mx-auto mb-4" />
        <h1 className="font-display text-4xl font-bold text-soil mb-2">Log in to see your cart</h1>
        <p className="text-gray-500 mb-6">Your cart is tied to your account, so you&apos;ll need to sign in to add items and check out.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-paddy hover:bg-paddy-deep text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <LogIn size={16} />
            Log In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 border border-gray-300 hover:border-paddy text-gray-700 hover:text-paddy font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
          >
            <UserPlus size={16} />
            Sign Up
          </Link>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-paddy transition-colors mt-6"
        >
          <ArrowLeft size={14} />
          Or keep browsing products
        </Link>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <ShoppingCart size={56} className="text-gray-300 mx-auto mb-4" />
        <h1 className="font-display text-4xl font-bold text-soil mb-2">Your cart is empty</h1>
        <p className="text-gray-500 mb-6">Browse our products and add something you like.</p>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 bg-paddy hover:bg-paddy-deep text-white font-semibold px-6 py-3 rounded-lg transition-colors text-sm"
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
        <h1 className="font-display text-4xl font-bold text-soil flex items-center gap-2">
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
        <div className="mb-6 flex items-start gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
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
              className="bg-white border border-gray-200 rounded-card p-4 flex gap-4 shadow-sm"
            >
              <div className="w-20 h-20 rounded-lg bg-gray-100 flex-shrink-0 relative overflow-hidden flex items-center justify-center">
                {item.imageUrl ? (
                  <Image src={item.imageUrl} alt={item.name} fill unoptimized className="object-cover" />
                ) : (
                  <Package size={28} className="text-gray-300" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-soil truncate">{item.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">₱{item.price.toFixed(2)} / {item.unit}</p>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      aria-label={`Less ${item.name}`}
                      onClick={() => updateQuantity(item.productId, parseFloat((item.quantity - unitStep(item.unit)).toFixed(2)))}
                      className="px-2.5 py-1.5 hover:bg-gray-100 transition-colors text-gray-600"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="px-3 py-1.5 text-sm font-medium text-gray-800 border-x border-gray-200">
                      {fmtQty(item.quantity)}
                    </span>
                    <button
                      aria-label={`More ${item.name}`}
                      onClick={() => updateQuantity(item.productId, parseFloat((item.quantity + unitStep(item.unit)).toFixed(2)))}
                      disabled={item.quantity + unitStep(item.unit) > maxBuyable(item.stock, item.unit) + 1e-9}
                      className="px-2.5 py-1.5 hover:bg-gray-100 transition-colors text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="text-xs text-gray-500">
                    of {parseFloat(item.stock.toFixed(2))} {item.unit} available
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end justify-between flex-shrink-0">
                <p className="font-bold text-paddy">₱{(item.price * item.quantity).toFixed(2)}</p>
                <button
                  onClick={() => removeItem(item.productId)}
                  className="text-gray-500 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-card p-4 sm:p-6 shadow-sm sticky top-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-soil">Order Summary</h2>

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
                <span className="font-semibold text-soil">Total</span>
                <span className="text-xl font-bold text-paddy">₱{totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Wallet size={14} /> Payment Method
              </label>
              <select aria-label="Payment Method"
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
              >
                <option value="cod">Cash on Delivery</option>
                <option value="gcash" disabled={!gcashOk}>
                  {gcashOk === false ? 'GCash (unavailable)' : 'GCash'}
                </option>
              </select>
              {gcashOk === false && (
                <p className="mt-1.5 text-xs text-gray-500">GCash is unavailable: this farmer hasn&apos;t set up GCash.</p>
              )}
              {paymentMethod === 'gcash' && (
                <p className="mt-1.5 text-xs text-gray-600">
                  After you place the order, send the amount to the farmer&apos;s GCash and enter the reference number in My Orders.
                </p>
              )}
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
                        ? 'bg-paddy text-white border-paddy'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-paddy'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 flex items-start gap-1 text-xs text-gray-500">
                <Info size={12} className="shrink-0 mt-0.5" /> Delivery only within {DELIVERY_AREA_TEXT}.
              </p>

              {deliveryMethod === 'delivery' && (
                <div className={`mt-3 rounded-lg border px-3 py-2.5 text-xs ${hasSpot && !location?.deliveryTown ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-gray-200 bg-gray-50 text-gray-600'}`}>
                  {hasSpot ? (
                    <>
                      <p className="font-medium text-soil">{location?.deliveryTown ?? 'Outside the delivery area'}</p>
                      <p className="mt-0.5 break-words">{location?.deliveryAddress}</p>
                      {!location?.deliveryTown && <p className="mt-1">This spot is outside the area, so this order can only be picked up. Choose Pickup, or set a spot inside the area.</p>}
                    </>
                  ) : (
                    <p>Set where to deliver before placing the order.</p>
                  )}
                  <button type="button" onClick={() => setPicking(true)} className="mt-1.5 font-medium text-paddy hover:underline">
                    {hasSpot ? 'Change location' : 'Set delivery location'}
                  </button>
                </div>
              )}
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
              disabled={placing || deliveryBlocked}
              className="w-full bg-paddy hover:bg-paddy-deep disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
            >
              {placing && <Loader2 size={16} className="animate-spin" />}
              {placing ? 'Placing Order…' : isAuthenticated ? 'Place Order' : 'Login to Checkout'}
            </button>

            <Link
              href="/products"
              className="block text-center text-sm text-gray-500 hover:text-paddy transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>

      {picking && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setPicking(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pick-title"
            className="w-full sm:max-w-xl max-h-[92vh] overflow-y-auto bg-white rounded-t-card sm:rounded-card shadow-xl p-4 sm:p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 id="pick-title" className="font-display text-xl font-bold text-soil flex items-center gap-2"><MapPin size={18} /> Delivery location</h2>
              <button type="button" onClick={() => setPicking(false)} aria-label="Close" className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"><X size={18} /></button>
            </div>
            <LocationPicker
              initial={location}
              token={token}
              saveLabel="Save and use this location"
              onSaved={loc => { setLocation(l => ({ ...l, ...loc })); setPicking(false) }}
            />
            <p className="mt-3 text-xs text-gray-500">Saved to your profile. Only the farmer of this order sees it.</p>
          </div>
        </div>
      )}
    </div>
  )
}
