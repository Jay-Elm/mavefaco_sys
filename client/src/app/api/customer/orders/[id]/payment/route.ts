import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { NextRequest, NextResponse } from 'next/server'
import { paymentSubmitSchema } from '@/validators/payment'
import { CAN_SUBMIT, PAYABLE_ORDER_STATUSES } from '@/lib/payment'

/**
 * POST /api/customer/orders/[id]/payment — the customer says they paid a
 * GCash order: the 13-digit reference and the account they paid from. The
 * farmer then checks their GCash and confirms or rejects it.
 */
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getActiveAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orderId = Number((await context.params).id)
  if (!Number.isInteger(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }
  const parsed = paymentSubmitSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const { reference, payerName, payerNumber } = parsed.data

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.customerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (order.paymentMethod !== 'gcash')
    return NextResponse.json({ error: 'This order is not paid by GCash' }, { status: 400 })
  if (!PAYABLE_ORDER_STATUSES.includes(order.status))
    return NextResponse.json({ error: `A ${order.status} order can't be paid` }, { status: 400 })
  if (!CAN_SUBMIT.includes(order.paymentStatus))
    return NextResponse.json({ error: 'A payment was already entered for this order' }, { status: 409 })

  try {
    const { count } = await prisma.order.updateMany({
      // Conditional, so two quick submits can't both land.
      where: { id: orderId, paymentStatus: order.paymentStatus, status: { in: [...PAYABLE_ORDER_STATUSES] } },
      data: { paymentStatus: 'submitted', gcashReference: reference, payerName, payerNumber },
    })
    if (count === 0) return NextResponse.json({ error: 'Order changed, please refresh' }, { status: 409 })
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002')
      return NextResponse.json({ error: 'That reference number was already used for another order' }, { status: 409 })
    throw err
  }

  await prisma.auditLog.create({ data: { action: 'SUBMIT_PAYMENT', entityType: 'ORDER', entityId: orderId, userId: user.id } })

  // Saved to the profile too, so the next payment is prefilled.
  await prisma.user.update({ where: { id: user.id }, data: { gcashName: payerName, gcashNumber: payerNumber } })

  return NextResponse.json({ id: orderId, paymentStatus: 'submitted' })
}
