import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const user = await getActiveAuthUser(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const orders = await prisma.order.findMany({
      where: { customerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        paymentMethod: true,
        paymentStatus: true,
        gcashReference: true,
        payerName: true,
        payerNumber: true,
        paidAt: true,
        deliveryMethod: true,
        deliveryAddress: true,
        deliveryTown: true,
        createdAt: true,
        customerNotifiedAt: true,
        customerSeenAt: true,
        items: {
          select: {
            id: true,
            quantity: true,
            price: true,
            product: {
              select: {
                id: true, name: true, imageUrl: true, unit: true,
                farmer: { select: { id: true, name: true, gcashName: true, gcashNumber: true, gcashQrUrl: true } },
              },
            },
          },
        },
      },
    })

    return NextResponse.json(
      orders.map(({ items, customerNotifiedAt, customerSeenAt, ...o }) => {
        // One farmer per order. Their GCash details go only with GCash orders.
        const farmer = items[0]?.product.farmer
        return {
          ...o,
          totalAmount: Number(o.totalAmount),
          // Changed by the farmer or staff since the customer last opened My Orders.
          updated: customerNotifiedAt !== null && customerNotifiedAt > customerSeenAt,
          farmer: farmer ? { id: farmer.id, name: farmer.name } : null,
          payTo:
            o.paymentMethod === 'gcash' && farmer?.gcashNumber
              ? { name: farmer.gcashName, number: farmer.gcashNumber, qrUrl: farmer.gcashQrUrl }
              : null,
          items: items.map((i) => ({
            id: i.id,
            quantity: i.quantity,
            price: Number(i.price),
            product: { id: i.product.id, name: i.product.name, imageUrl: i.product.imageUrl, unit: i.product.unit },
          })),
        }
      }),
    )
  } catch {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 })
  }
}
