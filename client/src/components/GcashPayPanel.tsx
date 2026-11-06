'use client'

import { useState } from 'react'
import Image from 'next/image'
import { AlertTriangle, CheckCircle, Clock, Loader2, Undo2 } from 'lucide-react'
import { CAN_SUBMIT, PAYABLE_ORDER_STATUSES, fmtMobile } from '@/lib/payment'

export interface PayableOrder {
  id: number
  totalAmount: number
  status: string
  paymentStatus: string
  gcashReference: string | null
  farmer: { id: number; name: string } | null
  payTo: { name: string | null; number: string; qrUrl: string | null } | null
}

/**
 * The customer's side of a GCash order: where to send the money, a form for
 * the reference number, and what the farmer said about it.
 */
export default function GcashPayPanel({
  order,
  token,
  payer,
  onChanged,
}: {
  order: PayableOrder
  token: string | null
  /** The customer's saved GCash details, to prefill the form. */
  payer: { name: string; number: string }
  onChanged: (paymentStatus: string, reference: string) => void
}) {
  const [reference, setReference] = useState('')
  const [name, setName] = useState(payer.name)
  const [number, setNumber] = useState(payer.number ? fmtMobile(payer.number) : '')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const amount = `₱${order.totalAmount.toFixed(2)}`
  const canPay = CAN_SUBMIT.includes(order.paymentStatus) && PAYABLE_ORDER_STATUSES.includes(order.status)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)
    try {
      const res = await fetch(`/api/customer/orders/${order.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reference, payerName: name.trim(), payerNumber: number }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not send'); return }
      onChanged(data.paymentStatus, reference.replace(/\s/g, ''))
    } catch {
      setError('Could not send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const s = order.paymentStatus
  if (s === 'confirmed')
    return <Note tone="ok" icon={<CheckCircle size={15} />}>Paid. {order.farmer?.name ?? 'The farmer'} confirmed your GCash payment.</Note>
  if (s === 'submitted')
    return (
      <Note tone="wait" icon={<Clock size={15} />}>
        Payment sent (reference {order.gcashReference}). Waiting for {order.farmer?.name ?? 'the farmer'} to check their GCash.
      </Note>
    )
  if (s === 'refund_due')
    return (
      <Note tone="warn" icon={<Undo2 size={15} />}>
        This order was cancelled after you paid. {order.farmer?.name ?? 'The farmer'} owes you a refund of {amount} by GCash. Message them if it doesn&apos;t arrive.
      </Note>
    )
  if (s === 'refunded')
    return <Note tone="ok" icon={<Undo2 size={15} />}>{order.farmer?.name ?? 'The farmer'} says they refunded your GCash payment.</Note>
  if (!canPay) return null

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3">
      {s === 'rejected' && (
        <p className="flex items-start gap-1.5 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {order.farmer?.name ?? 'The farmer'} couldn&apos;t find that payment in their GCash. Check the reference number and enter it again.
        </p>
      )}
      {order.payTo ? (
        <div className="flex gap-4">
          {order.payTo.qrUrl && (
            <div className="relative w-28 h-28 shrink-0 rounded-md border border-gray-200 bg-white overflow-hidden">
              <Image src={order.payTo.qrUrl} alt={`GCash QR code of ${order.payTo.name ?? 'the farmer'}`} fill unoptimized className="object-contain" />
            </div>
          )}
          <div className="text-sm text-gray-700 space-y-0.5">
            <p className="font-semibold text-soil">Send {amount} by GCash to:</p>
            <p>{order.payTo.name}</p>
            <p className="font-mono tabular text-base text-soil">{fmtMobile(order.payTo.number)}</p>
            <p className="text-xs text-gray-500 pt-1">Then enter the 13-digit reference number from your GCash receipt.</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-amber-800">The farmer has removed their GCash details. Message them to arrange payment.</p>
      )}

      {order.payTo && (
        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <label className="text-xs text-gray-600 sm:col-span-3">
            Reference number
            <input value={reference} onChange={e => setReference(e.target.value)} required inputMode="numeric" autoComplete="off" placeholder="1234 567 891234"
              className="mt-0.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-paddy" />
          </label>
          <label className="text-xs text-gray-600">
            Your GCash name
            <input value={name} onChange={e => setName(e.target.value)} required autoComplete="off"
              className="mt-0.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy" />
          </label>
          <label className="text-xs text-gray-600">
            Paid from number
            <input value={number} onChange={e => setNumber(e.target.value)} required inputMode="tel" autoComplete="off" placeholder="0917 123 4567"
              className="mt-0.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-paddy" />
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={sending}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-paddy text-white text-sm font-medium rounded-lg hover:bg-paddy-deep disabled:opacity-60">
              {sending && <Loader2 size={14} className="animate-spin" />} I&apos;ve paid
            </button>
          </div>
          {error && <p role="alert" className="sm:col-span-3 text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}

function Note({ tone, icon, children }: { tone: 'ok' | 'wait' | 'warn'; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = { ok: 'bg-shoot/40 border-shoot text-paddy-deep', wait: 'bg-blue-50 border-blue-200 text-blue-800', warn: 'bg-amber-50 border-amber-200 text-amber-800' }[tone]
  return <p className={`flex items-start gap-2 text-sm rounded-lg border px-3 py-2.5 ${cls}`}><span className="shrink-0 mt-0.5">{icon}</span><span>{children}</span></p>
}
