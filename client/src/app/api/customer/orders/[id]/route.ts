import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { NextRequest, NextResponse } from 'next/server'

// Customer-allowed status transitions
const ALLOWED_TRANSITIONS: Record<string, string> = {
  pending: 'cancelled',   // customer can cancel a pending order
  shipped: 'delivered',   // customer can confirm receipt
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getActiveAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await context.params
  const orderId = Number(id)
  if (isNaN(orderId)) return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 })

  const order = await prisma.order.findUnique({ where: { id: orderId } })
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.customerId !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { status?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { status } = body
  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 })

  const allowed = ALLOWED_TRANSITIONS[order.status]
  if (!allowed || allowed !== status) {
    return NextResponse.json(
      { error: `Cannot change order from "${order.status}" to "${status}"` },
      { status: 400 },
    )
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: orderId },
      data: { status },
      select: { id: true, status: true },
    })

    if (status === 'cancelled') {
      const items = await tx.orderItem.findMany({ where: { orderId } })
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        })
      }
    }

    await tx.auditLog.create({
      data: {
        action: status === 'cancelled' ? 'CANCEL_ORDER' : 'CONFIRM_RECEIVED',
        entityType: 'Order',
        entityId: orderId,
        userId: user.id,
      },
    })

    return result
  })

  return NextResponse.json(updated)
}
