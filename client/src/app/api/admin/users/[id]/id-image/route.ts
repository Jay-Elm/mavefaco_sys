import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { authorize } from '@/lib/authorize'
import { ROLES } from '@/lib/roles'

const BUCKET = 'id-verification'
const SIGNED_URL_TTL_SECONDS = 300

/**
 * Mints a short-lived signed URL for an admin/manager to view a farmer's
 * submitted ID. The object itself lives in a private bucket — this is the
 * only way to view it, and the link expires in 5 minutes.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const actor = await getActiveAuthUser(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!authorize(actor, [ROLES.ADMIN, ROLES.MANAGER]))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await context.params
  const userId = Number(id)
  if (isNaN(userId)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { idImagePath: true },
  })
  if (!target?.idImagePath) {
    return NextResponse.json({ error: 'No ID submitted' }, { status: 404 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }

  const signRes = await fetch(
    `${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${target.idImagePath}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
    },
  )

  if (!signRes.ok) {
    const errText = await signRes.text()
    console.error('Supabase Storage sign error:', errText)
    return NextResponse.json({ error: 'Failed to generate a view link' }, { status: 500 })
  }

  const data: { signedURL?: string } = await signRes.json()
  if (!data.signedURL) {
    return NextResponse.json({ error: 'Failed to generate a view link' }, { status: 500 })
  }

  return NextResponse.json({ url: `${supabaseUrl}/storage/v1${data.signedURL}` })
}
