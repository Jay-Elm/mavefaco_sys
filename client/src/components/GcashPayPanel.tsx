'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle, Clock, Loader2, Undo2 } from 'lucide-react'
import { CAN_SUBMIT, PAYABLE_ORDER_STATUSES, fmtMobile } from '@/lib/payment'
import { CopyButton, QrViewer } from '@/components/PayHelpers'

export interface PayableOrder {
  id: number
  totalAmount: number
  status: string
  paymentStatus: string
  gcashReference: string | null
  refundReference?: string | null
  farmer: { id: number; name: string } | null
  payTo: { name: string | null; number: string; qrUrl: string | null } | null
}

/**
 * The customer's side of a GCash order: three numbered steps (the farmer's
 * QR to save or scan, the number and amount to copy, then the reference
 * number), and what the farmer said about the payment. The account paid
 * from comes from the customer's saved GCash details; without them it is
 * asked once and saved to their profile.
 */
export default function GcashPayPanel({
  order,
  token,
  payer,
  onChanged,
}: {
  order: PayableOrder
  token: string | null
  /** The customer's saved GCash details. */
  payer: { name: string; number: string }
  onChanged: (paymentStatus: string, reference: string) => void
}) {
  const [reference, setReference] = useState('')
  const [otherAccount, setOtherAccount] = useState(false)
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const amount = `₱${order.totalAmount.toFixed(2)}`
  const canPay = CAN_SUBMIT.includes(order.paymentStatus) && PAYABLE_ORDER_STATUSES.includes(order.status)
  const hasSaved = Boolean(payer.number && payer.name)
  const askAccount = !hasSaved || otherAccount
  const farmer = order.farmer?.name ?? 'The farmer'

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSending(true)
    const payerName = askAccount ? name.trim() : payer.name
    const payerNumber = askAccount ? number : payer.number
    try {
      const res = await fetch(`/api/customer/orders/${order.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reference, payerName, payerNumber }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Could not send'); return }
      // First GCash payment: remember the account for next time.
      if (!hasSaved) {
        fetch('/api/users/me/gcash', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: payerName, number: payerNumber }),
        }).catch(() => {})
      }
      onChanged(data.paymentStatus, reference.replace(/\s/g, ''))
    } catch {
      setError('Could not send. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const s = order.paymentStatus
  if (s === 'confirmed')
    return <Note tone="ok" icon={<CheckCircle size={15} />}>Paid. {farmer} confirmed your GCash payment.</Note>
  if (s === 'submitted')
    return (
      <Note tone="wait" icon={<Clock size={15} />}>
        Payment sent (reference {order.gcashReference}). Waiting for {order.farmer?.name ?? 'the farmer'} to check their GCash.
      </Note>
    )
  if (s === 'refund_due')
    return (
      <Note tone="warn" icon={<Undo2 size={15} />}>
        This order was cancelled after you paid. {farmer} owes you a refund of {amount} by GCash. Message them if it doesn&apos;t arrive.
      </Note>
    )
  if (s === 'refunded')
    return (
      <Note tone="ok" icon={<Undo2 size={15} />}>
        {farmer} says they refunded your GCash payment{order.refundReference ? ` (reference ${order.refundReference})` : ''}.
      </Note>
    )
  if (!canPay) return null

  const step = 'flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-paddy text-[11px] font-bold text-white'
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 space-y-3">
      {s === 'rejected' && (
        <p className="flex items-start gap-1.5 text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {farmer} couldn&apos;t find that payment in their GCash. Check the reference number and enter it again.
        </p>
      )}
      {order.payTo ? (
        <>
          <p className="font-semibold text-soil text-sm">Pay {amount} to {order.payTo.name} by GCash</p>
          <div className="flex flex-col sm:flex-row gap-4">
            {order.payTo.qrUrl && (
              <QrViewer url={order.payTo.qrUrl} alt={`GCash QR code of ${order.payTo.name ?? 'the farmer'}`} filename={`gcash-qr-order-${order.id}.png`} />
            )}
            <ol className="space-y-3 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className={step}>1</span>
                <span>
                  {order.payTo.qrUrl
                    ? <>In GCash, tap <strong>Scan QR</strong> and scan the code, or save it and choose <strong>Upload QR</strong>. Or send to this number:</>
                    : <>In GCash, tap <strong>Send</strong> and enter this number:</>}
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular text-base text-soil">{fmtMobile(order.payTo.number)}</span>
                    <CopyButton value={order.payTo.number} label="Copy number" />
                  </span>
                </span>
              </li>
              <li className="flex gap-2">
                <span className={step}>2</span>
                <span>
                  Send exactly
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono tabular text-base text-soil">{amount}</span>
                    <CopyButton value={order.totalAmount.toFixed(2)} label="Copy amount" />
                  </span>
                </span>
              </li>
              <li className="flex gap-2">
                <span className={step}>3</span>
                <span>Enter the 13-digit reference number from your GCash receipt below.</span>
              </li>
            </ol>
          </div>
        </>
      ) : (
        <p className="text-sm text-amber-800">The farmer has removed their GCash details. Message them to arrange payment.</p>
      )}

      {order.payTo && (
        <form onSubmit={submit} className="space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <label className="flex-1 text-xs text-gray-600">
              Reference number
              <input value={reference} onChange={e => setReference(e.target.value)} required inputMode="numeric" autoComplete="off" placeholder="1234 567 891234"
                className="mt-0.5 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-paddy" />
            </label>
            <div className="flex items-end">
              <button type="submit" disabled={sending}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 bg-paddy text-white text-sm font-medium rounded-lg hover:bg-paddy-deep disabled:opacity-60">
                {sending && <Loader2 size={14} className="animate-spin" />} I&apos;ve paid
              </button>
            </div>
          </div>

          {askAccount ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
              <p className="sm:col-span-2 text-xs text-gray-500">
                {hasSaved
                  ? <button type="button" onClick={() => setOtherAccount(false)} className="text-paddy hover:underline">Use my saved GCash ({payer.name}) instead</button>
                  : 'So the farmer can find your payment. Saved to your profile for next time.'}
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">
              Paid from {payer.name}, {fmtMobile(payer.number)}.{' '}
              <button type="button" onClick={() => setOtherAccount(true)} className="text-paddy hover:underline">Paid from a different account?</button>
            </p>
          )}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </div>
  )
}

function Note({ tone, icon, children }: { tone: 'ok' | 'wait' | 'warn'; icon: React.ReactNode; children: React.ReactNode }) {
  const cls = { ok: 'bg-shoot/40 border-shoot text-paddy-deep', wait: 'bg-blue-50 border-blue-200 text-blue-800', warn: 'bg-amber-50 border-amber-200 text-amber-800' }[tone]
  return <p className={`flex items-start gap-2 text-sm rounded-lg border px-3 py-2.5 ${cls}`}><span className="shrink-0 mt-0.5">{icon}</span><span>{children}</span></p>
}
