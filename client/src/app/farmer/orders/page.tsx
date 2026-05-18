'use client'

import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Loader2, ShoppingCart, AlertTriangle, Download } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'

interface OrderRow {
  id: number
  status: string
  totalAmount: number
  createdAt: string
  customer: { id: number; name: string; email: string }
  items: { id: number; quantity: number; price: number; product: { id: number; name: string } }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-600',
}

// State machine: what transitions are allowed per status
const ACTIONS: Record<string, { label: string; next: string; style: string }[]> = {
  pending: [
    { label: 'Accept', next: 'confirmed', style: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
    { label: 'Reject', next: 'cancelled', style: 'bg-red-100 text-red-700 hover:bg-red-200' },
  ],
  confirmed: [
    { label: 'Mark Shipped', next: 'shipped', style: 'bg-purple-100 text-purple-700 hover:bg-purple-200' },
    { label: 'Cancel', next: 'cancelled', style: 'bg-red-100 text-red-700 hover:bg-red-200' },
  ],
  shipped: [
    { label: 'Mark Delivered', next: 'delivered', style: 'bg-green-100 text-green-700 hover:bg-green-200' },
  ],
  delivered: [],
  cancelled: [],
}

export default function FarmerOrdersPage() {
  const { token } = useAuth()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [updateError, setUpdateError] = useState<{ id: number; msg: string } | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    if (!token) return
    fetch('/api/farmer/orders', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setOrders(data)
      })
      .catch(() => setError('Failed to load orders'))
      .finally(() => setLoading(false))
  }, [token])

  async function handleStatusChange(orderId: number, status: string) {
    if (!token) return
    setUpdatingId(orderId)
    setUpdateError(null)
    try {
      const res = await fetch(`/api/farmer/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      if (!res.ok) { setUpdateError({ id: orderId, msg: data.error ?? 'Failed to update order' }); return }
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)))
    } catch {
      setUpdateError({ id: orderId, msg: 'Request failed' })
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{orders.length} total</span>
          <button
            onClick={() => downloadCSV(
              'my-orders.csv',
              ['Order ID', 'Customer', 'Email', 'Total (PHP)', 'Status', 'Items', 'Date'],
              orders.map((o) => [
                o.id, o.customer.name, o.customer.email,
                o.totalAmount.toFixed(2), o.status, o.items.length,
                new Date(o.createdAt).toLocaleDateString('en-PH'),
              ])
            )}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg px-3 py-2 transition-colors disabled:opacity-40"
          >
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Order ID</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Customer</th>
              <th className="px-5 py-3 text-right font-medium text-gray-500">Total</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Status</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Actions</th>
              <th className="px-5 py-3 text-left font-medium text-gray-500">Date</th>
              <th className="px-5 py-3 text-center font-medium text-gray-500">Items</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <ShoppingCart size={32} className="mx-auto mb-2" />
                  No orders yet
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <React.Fragment key={order.id}>
                  {updateError?.id === order.id && (
                    <tr className="bg-red-50">
                      <td colSpan={7} className="px-5 py-2">
                        <span className="flex items-center gap-2 text-xs text-red-700">
                          <AlertTriangle size={13} />
                          {updateError.msg}
                          <button onClick={() => setUpdateError(null)} className="ml-auto text-red-500 hover:text-red-700 underline">Dismiss</button>
                        </span>
                      </td>
                    </tr>
                  )}
                  <tr
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                  >
                    <td className="px-5 py-3 font-mono text-gray-500">#{order.id}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium text-gray-900">{order.customer.name}</p>
                      <p className="text-xs text-gray-400">{order.customer.email}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-green-700">
                      ₱{order.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {updatingId === order.id && (
                          <Loader2 size={12} className="animate-spin text-gray-400" />
                        )}
                        {(ACTIONS[order.status] ?? []).map((action) => (
                          <button
                            key={action.next}
                            onClick={() => handleStatusChange(order.id, action.next)}
                            disabled={updatingId === order.id}
                            className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 ${action.style}`}
                          >
                            {action.label}
                          </button>
                        ))}
                        {(ACTIONS[order.status] ?? []).length === 0 && (
                          <span className="text-xs text-gray-400 italic">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString('en-PH')}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-600">
                      {order.items.length}
                    </td>
                  </tr>
                  {expanded === order.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-10 py-3">
                        <p className="text-xs font-semibold text-gray-500 mb-2">Your items in this order:</p>
                        <div className="space-y-1">
                          {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between text-xs text-gray-600">
                              <span>{item.product.name} × {item.quantity}</span>
                              <span>₱{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
