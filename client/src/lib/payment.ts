/**
 * GCash orders are paid straight to the farmer's own GCash account. The
 * system never touches the money: it only records what each side says.
 *
 *   unpaid      no payment entered yet
 *   submitted   the customer entered a GCash reference number
 *   rejected    the farmer couldn't find that payment; the customer can enter it again
 *   confirmed   the farmer says the money arrived
 *   refund_due  the order was cancelled after a payment was entered
 *   refunded    the farmer says they sent the money back
 *
 * Cash on delivery orders keep "unpaid" and the screens don't show it.
 */
export const PAYMENT_STATUSES = ['unpaid', 'submitted', 'rejected', 'confirmed', 'refund_due', 'refunded'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cod: 'Cash on Delivery',
  gcash: 'GCash',
  // No longer offered; old orders keep their label.
  bank_transfer: 'Bank Transfer',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Not paid yet',
  submitted: 'Payment sent, waiting for the farmer',
  rejected: 'Payment not found',
  confirmed: 'Paid',
  refund_due: 'Refund due',
  refunded: 'Refunded',
}

/** Statuses in which the customer can enter (or re-enter) a reference. */
export const CAN_SUBMIT: readonly string[] = ['unpaid', 'rejected']

/** Order statuses in which paying still makes sense. */
export const PAYABLE_ORDER_STATUSES: readonly string[] = ['pending', 'confirmed']

/** What a GCash order's payment becomes when the order is cancelled. */
export function paymentAfterCancel(method: string, status: string): string {
  if (method !== 'gcash') return status
  return status === 'submitted' || status === 'confirmed' ? 'refund_due' : status
}

/**
 * What it becomes when an administrator reopens a cancelled order: money
 * still held goes back to waiting for the farmer's check; money already
 * returned means the customer pays again.
 */
export function paymentAfterReopen(method: string, status: string): string {
  if (method !== 'gcash') return status
  if (status === 'refund_due') return 'submitted'
  if (status === 'refunded') return 'unpaid'
  return status
}

/** A GCash order can't be shipped until the farmer confirmed the payment. */
export function shipBlockedReason(method: string, status: string): string | null {
  return method === 'gcash' && status !== 'confirmed'
    ? 'This GCash order can be shipped once you confirm the payment arrived'
    : null
}

/** "09171234567" from 0917 123 4567, +63 917 123 4567 or 639171234567; null if not a PH mobile number. */
export function normalizeMobile(raw: string): string | null {
  const digits = raw.replace(/[\s\-()]/g, '')
  const m = /^(?:\+?63|0)?(9\d{9})$/.exec(digits)
  return m ? `0${m[1]}` : null
}

/** GCash reference numbers are 13 digits; people often type them with spaces. */
export function normalizeReference(raw: string): string | null {
  const digits = raw.replace(/\s/g, '')
  return /^\d{13}$/.test(digits) ? digits : null
}

/** 0917 123 4567 */
export function fmtMobile(n: string): string {
  return n.length === 11 ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : n
}
