'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { refreshNavBadges } from '@/components/NavBadge'
import Link from 'next/link'
import { Loader2, ShoppingCart, AlertTriangle, Download, ChevronRight, MessageCircle, MapPin, ExternalLink } from 'lucide-react'
import { downloadCSV } from '@/lib/csv'
import { useDialog } from '@/contexts/DialogContext'
import { useLiveVersion } from '@/contexts/LiveUpdatesContext'
import ListToolbar from '@/components/ListToolbar'
import { PAYMENT_METHOD_LABELS, fmtMobile, shipBlockedReason } from '@/lib/payment'

interface OrderRow {
  id: number
  status: string
  totalAmount: number
  createdAt: string
  paymentMethod: string
  paymentStatus: string
  gcashReference: string | null
  payerName: string | null
  payerNumber: string | null
  paidAt: string | null
  deliveryMethod: string
  deliveryLat: number | null
  deliveryLng: number | null
  deliveryAddress: string | null
  deliveryTown: string | null
  customer: { id: number; name: string; email: string }
  items: { id: number; quantity: number; price: number; product: { id: number; name: string; unit: string } }[]
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-shoot text-paddy-deep',
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
    { label: 'Mark Delivered', next: 'delivered', style: 'bg-shoot text-paddy hover:bg-shoot' },
  ],
  delivered: [],
  cancelled: [],
}

// How a GCash order's payment reads to the farmer, and what they can do about it.
const GCASH_CHIP: Record<string, { label: string; style: string }> = {
  unpaid: { label: 'GCash: not paid yet', style: 'bg-gray-100 text-gray-600' },
  submitted: { label: 'GCash: check payment', style: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'GCash: not found', style: 'bg-red-100 text-red-700' },
  confirmed: { label: 'GCash: paid', style: 'bg-shoot text-paddy-deep' },
  refund_due: { label: 'Refund due', style: 'bg-amber-100 text-amber-800' },
  refunded: { label: 'Refunded', style: 'bg-gray-100 text-gray-600' },
}

const STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'] as const
type Sort = 'newest' | 'oldest' | 'total-desc' | 'total-asc'

export default function FarmerOrdersPage() {
  const { token } = useAuth()
  const live = useLiveVersion()
  const dialog = useDialog()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState<number | null>(null)
  const [updateError, setUpdateError] = useState<{ id: number; msg: string } | null>(null)
  const [expanded, setExpanded] = useState<number | null>(null)
  // A note per order for the customer, sent with the next status or payment
  // change (the automatic "Order update" message), then cleared.
  const [notes, setNotes] = useState<Record<number, string>>({})
  const noteFor = (id: number) => notes[id]?.trim() || undefined
  const clearNote = (id: number) => setNotes((prev) => { const next = { ...prev }; delete next[id]; return next })
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState<Sort>('newest')

  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase().replace(/^#/, '')
    const list = orders.filter((o) =>
      (status === 'all' || o.status === status) &&
      (!q ||
        String(o.id) === q ||
        o.customer.name.toLowerCase().includes(q) ||
        o.customer.email.toLowerCase().includes(q) ||
        o.items.some((i) => i.product.name.toLowerCase().includes(q))),
    )
    const time = (o: OrderRow) => new Date(o.createdAt).getTime()
    return list.sort((a, b) => {
      switch (sort) {
        case 'oldest': return time(a) - time(b)
        case 'total-desc': return b.totalAmount - a.totalAmount
        case 'total-asc': return a.totalAmount - b.totalAmount
        default: return time(b) - time(a)
      }
    })
  }, [orders, search, status, sort])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1
    return c
  }, [orders])

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
  }, [token, live])

  async function handleStatusChange(orderId: number, status: string) {
    if (!token) return
    const ps = orders.find((o) => o.id === orderId)?.paymentStatus
    const owes = ps === 'submitted' || ps === 'confirmed'
    if (status === 'cancelled' && !(await dialog.confirm({
      title: 'Cancel this order?',
      message: owes
        ? "This cannot be undone. The customer entered a GCash payment, so you'll owe them a refund."
        : 'This cannot be undone.',
      confirmLabel: 'Cancel order', cancelLabel: 'Keep order', tone: 'danger',
    }))) return
    setUpdatingId(orderId)
    setUpdateError(null)
    try {
      const res = await fetch(`/api/farmer/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, note: noteFor(orderId) }),
      })
      const data = await res.json()
      if (!res.ok) { setUpdateError({ id: orderId, msg: data.error ?? 'Failed to update order' }); return }
      clearNote(orderId)
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)))
      refreshNavBadges()
    } catch {
      setUpdateError({ id: orderId, msg: 'Request failed' })
    } finally {
      setUpdatingId(null)
    }
  }

  async function handlePayment(order: OrderRow, action: 'confirm' | 'reject' | 'refunded') {
    if (!token) return
    const amount = `₱${order.totalAmount.toFixed(2)}`
    const ask = {
      confirm: { title: `Did ${amount} arrive in your GCash?`, message: `Check your GCash app for reference ${order.gcashReference} from ${order.payerName ?? 'the customer'} before confirming. Once confirmed it can't be undone.`, confirmLabel: 'Yes, it arrived', tone: 'default' as const },
      reject: { title: 'Mark this payment as not received?', message: order.paymentStatus === 'refund_due' ? 'Use this only if no money ever arrived for this order. Nothing will be owed.' : 'The customer will be asked to check the reference number and enter it again.', confirmLabel: 'Not received', tone: 'danger' as const },
      refunded: { title: `Mark ${amount} as refunded?`, message: `Only after you have sent the money back to ${order.payerName ?? 'the customer'} (${order.payerNumber ? fmtMobile(order.payerNumber) : 'their GCash'}).`, confirmLabel: 'Refund sent', tone: 'default' as const },
    }[action]
    if (!(await dialog.confirm({ ...ask, cancelLabel: 'Back' }))) return
    setUpdatingId(order.id)
    setUpdateError(null)
    try {
      const res = await fetch(`/api/farmer/orders/${order.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action, note: noteFor(order.id) }),
      })
      const data = await res.json()
      if (!res.ok) { setUpdateError({ id: order.id, msg: data.error ?? 'Failed to update the payment' }); return }
      clearNote(order.id)
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, paymentStatus: data.paymentStatus, ...(action === 'confirm' && { paidAt: new Date().toISOString() }) } : o)))
    } catch {
      setUpdateError({ id: order.id, msg: 'Request failed' })
    } finally {
      setUpdatingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader2 size={28} className="animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-soil">Orders</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => downloadCSV(
              'my-orders.csv',
              ['Order ID', 'Customer', 'Email', 'Total (PHP)', 'Status', 'Payment', 'Payment status', 'Fulfillment', 'Items', 'Date'],
              orders.map((o) => [
                o.id, o.customer.name, o.customer.email,
                o.totalAmount.toFixed(2), o.status,
                PAYMENT_METHOD_LABELS[o.paymentMethod] ?? o.paymentMethod,
                o.paymentMethod === 'gcash' ? o.paymentStatus : '',
                o.deliveryMethod === 'delivery' ? `Delivery${o.deliveryTown ? ` (${o.deliveryTown})` : ''}` : 'Pickup',
                o.items.length,
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

      {orders.length > 0 && (
        <ListToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Search by customer, product or #ID"
          filters={[
            { label: 'Status', value: status, onChange: setStatus, options: [
              { value: 'all', label: 'All statuses' },
              ...STATUSES.map((s) => ({ value: s, label: `${s[0].toUpperCase()}${s.slice(1)} (${counts[s] ?? 0})` })),
            ] },
          ]}
          sort={{ label: 'Sort by', value: sort, onChange: (v) => setSort(v as Sort), options: [
            { value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' },
            { value: 'total-desc', label: 'Total: high to low' }, { value: 'total-asc', label: 'Total: low to high' },
          ] }}
          shown={displayed.length}
          total={orders.length}
          noun="orders"
          onClear={search.trim() || status !== 'all' ? () => { setSearch(''); setStatus('all') } : undefined}
        />
      )}

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
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
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  <ShoppingCart size={32} className="mx-auto mb-2" />
                  No orders yet
                </td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">No orders match these filters</td>
              </tr>
            ) : (
              displayed.map((order) => {
                const isOpen = expanded === order.id
                return (
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
                    className={`transition-colors cursor-pointer ${isOpen ? 'bg-shoot/50 border-b-0 shadow-[inset_4px_0_0_var(--color-paddy)]' : 'hover:bg-gray-50'}`}
                    onClick={() => setExpanded(isOpen ? null : order.id)}
                    aria-expanded={isOpen}
                  >
                    <td className="px-5 py-3 font-mono text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <ChevronRight size={14} aria-hidden className={`transition-transform ${isOpen ? 'rotate-90 text-paddy' : 'text-gray-400'}`} />
                        #{order.id}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-soil">{order.customer.name}</p>
                        <Link
                          href={`/farmer/messages/${order.customer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Message ${order.customer.name}`}
                          title={`Message ${order.customer.name}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-paddy hover:text-paddy-deep border border-paddy/30 hover:bg-shoot rounded-full px-2 py-0.5"
                        >
                          <MessageCircle size={12} aria-hidden /> Message
                        </Link>
                      </div>
                      <p className="text-xs text-gray-500">{order.customer.email}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-paddy">
                      ₱{order.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {order.status}
                      </span>
                      {order.paymentMethod === 'gcash' && GCASH_CHIP[order.paymentStatus] && (
                        <span className={`block w-max mx-auto mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${GCASH_CHIP[order.paymentStatus].style}`}>
                          {GCASH_CHIP[order.paymentStatus].label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {updatingId === order.id && (
                          <Loader2 size={12} className="animate-spin text-gray-500" />
                        )}
                        {order.paymentMethod === 'gcash' && order.paymentStatus === 'submitted' && (
                          <>
                            <button onClick={() => handlePayment(order, 'confirm')} disabled={updatingId === order.id}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 bg-shoot text-paddy-deep hover:bg-shoot/70">
                              Payment received
                            </button>
                            <button onClick={() => handlePayment(order, 'reject')} disabled={updatingId === order.id}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 bg-gray-100 text-gray-700 hover:bg-gray-200">
                              Not received
                            </button>
                          </>
                        )}
                        {order.paymentStatus === 'refund_due' && (
                          <>
                            <button onClick={() => handlePayment(order, 'refunded')} disabled={updatingId === order.id}
                              className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 bg-amber-100 text-amber-800 hover:bg-amber-200">
                              Refund sent
                            </button>
                            {!order.paidAt && (
                              <button onClick={() => handlePayment(order, 'reject')} disabled={updatingId === order.id}
                                className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 bg-gray-100 text-gray-700 hover:bg-gray-200">
                                No payment came
                              </button>
                            )}
                          </>
                        )}
                        {(ACTIONS[order.status] ?? []).map((action) => {
                          const blocked = action.next === 'shipped' ? shipBlockedReason(order.paymentMethod, order.paymentStatus) : null
                          return (
                            <button
                              key={action.next}
                              onClick={() => handleStatusChange(order.id, action.next)}
                              disabled={updatingId === order.id || Boolean(blocked)}
                              title={blocked ?? undefined}
                              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${action.style}`}
                            >
                              {action.label}
                            </button>
                          )
                        })}
                        {(ACTIONS[order.status] ?? []).length === 0 && order.paymentStatus !== 'refund_due' && (
                          <span className="text-xs text-gray-500 italic">—</span>
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
                  {isOpen && (
                    <tr className="bg-shoot/50 shadow-[inset_4px_0_0_var(--color-paddy)] border-b-2 border-paddy/20">
                      <td colSpan={7} className="px-10 pt-1 pb-4">
                        <div className="max-w-3xl grid gap-3 md:grid-cols-[3fr_2fr]">
                        <div className="rounded-lg bg-white/80 border border-paddy/15 px-4 py-3">
                          <p className="text-xs font-semibold text-paddy-deep mb-2">Order #{order.id}: your items</p>
                          <div className="space-y-1">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex justify-between gap-4 text-sm text-gray-700">
                                <span>{item.product.name} × {parseFloat(item.quantity.toFixed(2))} {item.product.unit}</span>
                                <span className="tabular">₱{(item.price * item.quantity).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="rounded-lg bg-white/80 border border-paddy/15 px-4 py-3 text-sm text-gray-700 space-y-2">
                          <div>
                            <p className="text-xs font-semibold text-paddy-deep">Payment</p>
                            <p>{PAYMENT_METHOD_LABELS[order.paymentMethod] ?? order.paymentMethod}</p>
                            {order.paymentMethod === 'gcash' && order.gcashReference && (
                              <p className="text-xs text-gray-600">
                                Ref <span className="font-mono">{order.gcashReference}</span>
                                {order.payerName && <> from {order.payerName}</>}
                                {order.payerNumber && <> ({fmtMobile(order.payerNumber)})</>}
                              </p>
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-paddy-deep">{order.deliveryMethod === 'delivery' ? 'Deliver to' : 'Fulfillment'}</p>
                            {order.deliveryMethod === 'delivery' ? (
                              <>
                                {order.deliveryTown && <p className="font-medium">{order.deliveryTown}</p>}
                                {order.deliveryAddress && <p className="text-xs text-gray-600 break-words">{order.deliveryAddress}</p>}
                                {order.deliveryLat != null && order.deliveryLng != null && (
                                  <a
                                    href={`https://www.openstreetmap.org/?mlat=${order.deliveryLat}&mlon=${order.deliveryLng}#map=18/${order.deliveryLat}/${order.deliveryLng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-paddy hover:underline"
                                  >
                                    <MapPin size={12} /> Open the pin on a map <ExternalLink size={11} />
                                  </a>
                                )}
                              </>
                            ) : (
                              <p>Pickup</p>
                            )}
                          </div>
                        </div>
                        {!['delivered', 'cancelled'].includes(order.status) || order.paymentStatus === 'refund_due' ? (
                          <div className="md:col-span-2 rounded-lg bg-white/80 border border-paddy/15 px-4 py-3">
                            <label htmlFor={`note-${order.id}`} className="text-xs font-semibold text-paddy-deep">
                              Note for the customer <span className="font-normal text-gray-500">(optional)</span>
                            </label>
                            <textarea
                              id={`note-${order.id}`}
                              value={notes[order.id] ?? ''}
                              onChange={(e) => setNotes((prev) => ({ ...prev, [order.id]: e.target.value }))}
                              rows={2}
                              maxLength={300}
                              placeholder="e.g. Ready after 3 pm at the barangay hall."
                              className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy"
                            />
                            <p className="text-xs text-gray-500">
                              The customer gets a message whenever you update this order; this note is added to the next one.
                            </p>
                          </div>
                        ) : null}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                )
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
