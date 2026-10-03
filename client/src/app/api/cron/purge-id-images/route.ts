import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { deleteIdImage, storageConfig } from '@/lib/idImageStorage'

// Government ID scans are regulated PII (RA 10173) collected only to
// verify an account — once an admin has approved it, there's no
// remaining purpose for keeping the raw image around. 30 days gives
// admins a window to revisit a decision before the underlying evidence
// is gone.
const RETENTION_DAYS = 30

/**
 * Vercel Cron target (see vercel.json) — purges the stored ID image for
 * any account that was verified more than RETENTION_DAYS ago. `verified`
 * and `verifiedAt` are left intact as the audit record of the decision;
 * only the image and its path are cleared. Submissions that are still
 * pending review (verified === false) are never touched here — an admin
 * still needs that image to act on it, no matter how old it is.
 *
 * The path is cleared only after storage confirms the delete. A failed
 * delete keeps it, so the next daily run retries, and the run answers 500
 * so the failure shows up in Vercel's cron logs.
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
  const targets = await prisma.user.findMany({
    where: { verified: true, verifiedAt: { lte: cutoff }, idImagePath: { not: null } },
    select: { id: true, idImagePath: true },
  })

  let purged = 0
  const failed: number[] = []
  for (const target of targets) {
    if (!target.idImagePath) continue
    if (!(await deleteIdImage(target.idImagePath))) {
      failed.push(target.id)
      continue
    }
    await prisma.user.update({ where: { id: target.id }, data: { idImagePath: null } })
    await prisma.auditLog.create({
      data: { action: 'AUTO_PURGE_ID_IMAGE', entityType: 'USER', entityId: target.id, userId: target.id },
    })
    purged++
  }

  if (failed.length > 0) {
    console.error(`purge-id-images: ${failed.length} image(s) not deleted, will retry next run; users:`, failed)
    return NextResponse.json({ purged, failed: failed.length }, { status: 500 })
  }
  return NextResponse.json({ purged, failed: 0 })
}
