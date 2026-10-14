import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { removeListing } from '@/lib/productRemoval'
import { SUSPENSION_DAYS } from '@/validators/productSuspension'

/**
 * Vercel Cron target (see vercel.json) — removes listings that were
 * suspended more than SUSPENSION_DAYS ago and never resubmitted. A listing
 * with history is archived rather than deleted (removeListing). One with an
 * order still in progress is skipped and retried on the next daily run,
 * since those orders carry on regardless of the suspension.
 *
 * The audit entry is attributed to the staff member who suspended the
 * listing (there's no user behind a cron run), falling back to the farmer.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('purge-suspended-products: CRON_SECRET not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - SUSPENSION_DAYS * 24 * 60 * 60 * 1000)
  const expired = await prisma.product.findMany({
    where: { archivedAt: null, suspendedAt: { lte: cutoff } },
    select: { id: true, farmerId: true, suspendedById: true },
  })

  let deleted = 0
  let archived = 0
  let skipped = 0
  for (const product of expired) {
    // Re-checked by the write, so a farmer resubmitting at this moment wins.
    const result = await removeListing(product.id, { suspendedAt: { lte: cutoff } })
    if (result === 'active-orders') { skipped++; continue }
    if (result === 'not-found') continue

    await prisma.auditLog.create({
      data: {
        action: result === 'archived' ? 'AUTO_ARCHIVE_PRODUCT' : 'AUTO_DELETE_PRODUCT',
        entityType: 'PRODUCT',
        entityId: product.id,
        userId: product.suspendedById ?? product.farmerId,
      },
    })
    if (result === 'archived') archived++
    else deleted++
  }

  return NextResponse.json({ deleted, archived, skipped })
}
