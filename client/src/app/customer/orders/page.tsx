'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ShoppingBag, ChevronDown, ChevronUp, Loader2, Package, X, CheckCheck } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

interface OrderItem {
  id: number
  quantity: number
  price: number
  product: { id: number; name: string; imageUrl: string | null; unit: string }
}

interface Order {
  id: number
  totalAmount: number
  status: string
  paymentMethod: string
  deliveryMethod: string
  createdAt: string
  items: OrderItem[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-700',
}

const PAYMENT_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  gcash: 'GCash',
  bank_transfer: 'Bank Transfer',
}

const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'Pickup',
  delivery: 'Delivery',
}

export default function CustomerOrdersPage() {
  const { isAuthenticated, loading, token } = useAuth()
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [actingId, setActingId] = useState<number | null>(null)
  const [actionError, setActionError] = useState<{ id: number; msg: string } | null>(null)

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) { router.replace('/login'); return }
    fetch('/api/customer/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setOrders(data)
        else setError(data.error ?? 'Failed to load orders')
      })
      .catch(() => setError('Network error'))
      .finally(() => setFetching(false))
  }, [loading, isAuthenticated, token, router])

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleAction(orderId: number, status: string) {
    if (!token) return
    setActingId(orderId)
    setActionError(null)
    try {
      const res = await fetch(`/api/customer/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) { setActionError({ id: orderId, msg: data.error }); return }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: data.status } : o))
    } catch {
      setActionError({ id: orderId, msg: 'Request failed' })
    } finally {
      setActingId(null)
    }
  }

  if (loading || fetching) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShoppingBag size={24} />
          My Orders
        </h1>
        <Link href="/products" className="text-sm text-green-700 hover:underline">
          Continue Shopping
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {orders.length === 0 && !error && (
        <div className="text-center py-20">
          <Package size={48} className="text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">You haven&apos;t placed any orders yet.</p>
          <Link
            href="/products"
            className="inline-flex items-center gap-2 bg-green-700 hover:bg-green-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Browse Products
          </Link>
        </div>
      )}

      <div className="space-y-4">
        {orders.map(order => {
          const isOpen = expanded.has(order.id)
          const date = new Intl.DateTimeFormat('en-PH', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          }).format(new Date(order.createdAt))

          return (
            <div key={order.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                onClick={() => toggleExpand(order.id)}
              >
                <div className="flex items-center gap-4 text-left">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">Order #{order.id}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{date}</p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="font-bold text-green-700">₱{order.totalAmount.toFixed(2)}</span>
                  {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 px-4 sm:px-6 py-4 space-y-4">
                  {/* Items */}
                  <div className="space-y-2">
                    {order.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/products/${item.product.id}`}
                            className="text-gray-800 hover:text-green-700 font-medium transition-colors"
                          >
                            {item.product.name}
                          </Link>
                          <span className="text-gray-400">× {parseFloat(item.quantity.toFixed(2))} {item.product.unit}</span>
                        </div>
                        <span className="text-gray-700 font-medium">
                          ₱{(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-semibold text-gray-900">
                      <span>Total</span>
                      <span className="text-green-700">₱{order.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Payment + delivery info */}
                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-700 mb-0.5">Payment</p>
                      <p>{PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 mb-0.5">Fulfillment</p>
                      <p>{DELIVERY_LABELS[order.deliveryMethod] ?? order.deliveryMethod}</p>
                    </div>
                  </div>

                  {/* Customer actions */}
                  {actionError?.id === order.id && (
                    <p className="text-xs text-red-600">{actionError.msg}</p>
                  )}
                  <div className="flex gap-2">
                    {order.status === 'pending' && (
                      <button
                        onClick={() => handleAction(order.id, 'cancelled')}
                        disabled={actingId === order.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-40"
                      >
                        {actingId === order.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <X size={12} />}
                        Cancel Order
                      </button>
                    )}
                    {order.status === 'shipped' && (
                      <button
                        onClick={() => handleAction(order.id, 'delivered')}
                        disabled={actingId === order.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-40"
                      >
                        {actingId === order.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : <CheckCheck size={12} />}
                        Confirm Received
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
