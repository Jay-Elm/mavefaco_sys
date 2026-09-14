import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { NextRequest, NextResponse } from 'next/server'
import { orderSchema } from '@/validators/order'

export async function POST(req: NextRequest) {
  const user = await getActiveAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const parsed = orderSchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const { items, paymentMethod, deliveryMethod } = parsed.data

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
        return sum + Number(product.price) * item.quantity
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

    return NextResponse.json({ ...order, totalAmount: Number(order.totalAmount) }, { status: 201 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to place order'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
