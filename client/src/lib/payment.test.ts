import { describe, expect, it } from 'vitest'
import { fmtMobile, normalizeMobile, normalizeReference, paymentAfterCancel, paymentAfterReopen, shipBlockedReason } from './payment'

describe('normalizeMobile', () => {
  it('accepts the usual ways of writing a PH mobile number', () => {
    for (const n of ['09171234567', '0917 123 4567', '+63 917 123 4567', '639171234567', '9171234567', '0917-123-4567'])
      expect(normalizeMobile(n)).toBe('09171234567')
  })
  it('rejects landlines, short numbers and letters', () => {
    for (const n of ['0521234567', '0917123456', '091712345678', 'abc', ''])
      expect(normalizeMobile(n)).toBeNull()
  })
})

describe('normalizeReference', () => {
  it('takes 13 digits, spaces allowed', () => {
    expect(normalizeReference('1234 567 891234')).toBe('1234567891234')
    expect(normalizeReference('123456789123')).toBeNull()
    expect(normalizeReference('12345678912a4')).toBeNull()
  })
})

describe('payment after order changes', () => {
  it('owes a refund only when money may have been sent', () => {
    expect(paymentAfterCancel('gcash', 'submitted')).toBe('refund_due')
    expect(paymentAfterCancel('gcash', 'confirmed')).toBe('refund_due')
    expect(paymentAfterCancel('gcash', 'unpaid')).toBe('unpaid')
    expect(paymentAfterCancel('gcash', 'rejected')).toBe('rejected')
    expect(paymentAfterCancel('cod', 'unpaid')).toBe('unpaid')
  })
  it('reopening puts held money back to checking and returned money to unpaid', () => {
    expect(paymentAfterReopen('gcash', 'refund_due')).toBe('submitted')
    expect(paymentAfterReopen('gcash', 'refunded')).toBe('unpaid')
    expect(paymentAfterReopen('gcash', 'unpaid')).toBe('unpaid')
  })
  it('blocks shipping unpaid GCash orders only', () => {
    expect(shipBlockedReason('gcash', 'submitted')).toMatch(/confirm the payment/)
    expect(shipBlockedReason('gcash', 'confirmed')).toBeNull()
    expect(shipBlockedReason('cod', 'unpaid')).toBeNull()
  })
})

describe('fmtMobile', () => {
  it('groups 4-3-4', () => expect(fmtMobile('09171234567')).toBe('0917 123 4567'))
})
