import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteIdImages, storageConfig } from '@/lib/idImageStorage'

// Government ID scans and selfies are regulated personal data (RA 10173)
// collected only to verify an account — once staff have decided, there's no
// remaining purpose for keeping them. 30 days gives staff a window to
// revisit a decision before the evidence is gone.
const RETENTION_DAYS = 30

/**
 * Vercel Cron target (see vercel.json) — deletes the images of ID
 * submissions approved or rejected more than RETENTION_DAYS ago, and of
 * replaced submissions straight away. The submission row stays as the
 * record of the decision; only the images and their paths go. Pending
 * submissions are never touched: staff still need them, however old.
 *
 * Paths are cleared only after storage confirms every delete. A failure
 * keeps them, so the next daily run retries, and the run answers 500 so the
 * failure shows up in Vercel's cron logs.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('purge-id-images: CRON_SECRET not configured')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }
  if (req.headers.get('authorization') !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!storageConfig()) {
    console.error('purge-id-images: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const targets = await prisma.idSubmission.findMany({
    where: {
      imagesPurgedAt: null,
      OR: [{ frontPath: { not: null } }, { backPath: { not: null } }, { selfiePath: { not: null } }],
      AND: [{ OR: [{ status: { in: ['approved', 'rejected'] }, reviewedAt: { lte: cutoff } }, { status: 'replaced' }] }],
    },
    select: { id: true, userId: true, frontPath: true, backPath: true, selfiePath: true },
  })

  let purged = 0
  const failed: number[] = []
  for (const target of targets) {
    if (!(await deleteIdImages([target.frontPath, target.backPath, target.selfiePath]))) {
      failed.push(target.id)
      continue
    }
    await prisma.idSubmission.update({
      where: { id: target.id },
      data: { frontPath: null, backPath: null, selfiePath: null, imagesPurgedAt: new Date() },
    })
    await prisma.auditLog.create({
      data: { action: 'AUTO_PURGE_ID_IMAGE', entityType: 'USER', entityId: target.userId, userId: target.userId },
    })
    purged++
  }

  if (failed.length > 0) {
    console.error(`purge-id-images: ${failed.length} submission(s) not fully deleted, will retry next run; ids:`, failed)
    return NextResponse.json({ purged, failed: failed.length }, { status: 500 })
  }
  return NextResponse.json({ purged, failed: 0 })
}
