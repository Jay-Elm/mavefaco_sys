import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BUCKET = 'id-verification'

// Government ID scans are regulated PII (RA 10173) collected only to
// verify an account — once an admin has approved it, there's no
// remaining purpose for keeping the raw image around. 30 days gives
// admins a window to revisit a decision before the underlying evidence
// is gone.
const RETENTION_DAYS = 30

/** Best-effort delete — never blocks the run on a storage hiccup. */
async function deleteObject(supabaseUrl: string, serviceKey: string, path: string) {
  try {
    await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [path] }),
    })
  } catch (err) {
    console.error('purge-id-images: failed to delete object', err)
  }
}

/**
 * Vercel Cron target (see vercel.json) — purges the stored ID image for
 * any account that was verified more than RETENTION_DAYS ago. `verified`
 * and `verifiedAt` are left intact as the audit record of the decision;
 * only the image and its path are cleared. Submissions that are still
 * pending review (verified === false) are never touched here — an admin
 * still needs that image to act on it, no matter how old it is.
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

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('purge-id-images: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }

  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  const targets = await prisma.user.findMany({
    where: { verified: true, verifiedAt: { lte: cutoff }, idImagePath: { not: null } },
    select: { id: true, idImagePath: true },
  })

  for (const target of targets) {
    if (!target.idImagePath) continue
    await deleteObject(supabaseUrl, serviceKey, target.idImagePath)
    await prisma.user.update({ where: { id: target.id }, data: { idImagePath: null } })
    await prisma.auditLog.create({
      data: { action: 'AUTO_PURGE_ID_IMAGE', entityType: 'USER', entityId: target.id, userId: target.id },
    })
  }

  return NextResponse.json({ purged: targets.length })
}
