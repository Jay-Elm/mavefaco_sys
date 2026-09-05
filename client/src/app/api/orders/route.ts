import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { NextRequest, NextResponse } from 'next/server'

interface OrderItemInput {
  productId: number
  quantity: number
}

const VALID_PAYMENT_METHODS = ['cod', 'gcash', 'bank_transfer'] as const
const VALID_DELIVERY_METHODS = ['pickup', 'delivery'] as const

export async function POST(req: NextRequest) {
  const user = await getActiveAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { items?: OrderItemInput[]; paymentMethod?: string; deliveryMethod?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { items, paymentMethod = 'cod', deliveryMethod = 'pickup' } = body

  if (!VALID_PAYMENT_METHODS.includes(paymentMethod as never))
    return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 })
  if (!VALID_DELIVERY_METHODS.includes(deliveryMethod as never))
    return NextResponse.json({ error: 'Invalid delivery method' }, { status: 400 })
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
  }

  for (const item of items) {
    if (!Number.isInteger(item.productId) || typeof item.quantity !== 'number' || item.quantity <= 0) {
      return NextResponse.json({ error: 'Invalid item data' }, { status: 400 })
    }
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      const productIds = items.map(i => i.productId)
      const products = await tx.product.findMany({ where: { id: { in: productIds } } })

      for (const item of items) {
        const product = products.find(p => p.id === item.productId)
        if (!product) throw new Error(`Product ${item.productId} not found`)
        if (!product.approved) throw new Error(`"${product.name}" is no longer available`)
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for "${product.name}" (only ${product.stock} left)`)
        }
      }

      const farmerIds = new Set(products.map(p => p.farmerId))
      if (farmerIds.size > 1) {
        throw new Error('All items in an order must be from the same farmer')
      }

      const totalAmount = items.reduce((sum, item) => {
        const product = products.find(p => p.id === item.productId)!
        return sum + product.price * item.quantity
      }, 0)

      const created = await tx.order.create({
        data: {
          customerId: user.id,
          totalAmount,
          status: 'pending',
          paymentMethod,
          deliveryMethod,
          items: {
            create: items.map(item => {
              const product = products.find(p => p.id === item.productId)!
              return {
                productId: item.productId,
                quantity: item.quantity,
                price: product.price,
              }
            }),
          },
        },
      })

      for (const item of items) {
        const { count } = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        })
        if (count === 0) {
          const product = products.find(p => p.id === item.productId)!
          throw new Error(`Insufficient stock for "${product.name}" — someone else just bought it`)
        }
      }

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entityType: 'Order',
          entityId: created.id,
          userId: user.id,
        },
      })

      return created
    })

    return NextResponse.json(order, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to place order'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
