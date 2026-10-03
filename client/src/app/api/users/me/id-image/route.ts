import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { rateLimit } from '@/lib/rateLimit'
import { detectImageType } from '@/lib/imageSniff'
import { ID_IMAGE_BUCKET, deleteIdImage, storageConfig } from '@/lib/idImageStorage'

/**
 * Uploads a government ID into the private "id-verification" bucket —
 * never a public bucket — and records only the storage path, not a URL.
 * Admins view it later via a short-lived signed URL
 * (GET /api/admin/users/[id]/id-image), never a permanently public link.
 *
 * Replacing a previous submission deletes the old file first-class: if
 * storage won't confirm that delete, the new upload is rolled back and the
 * old record kept, rather than leaving the old ID stored with nothing
 * pointing at it.
 */
export async function POST(req: NextRequest) {
  const actor = await getActiveAuthUser(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, retryAfterSeconds } = rateLimit(`id-image:${actor.id}`, 10, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  const config = storageConfig()
  if (!config) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }
  const { supabaseUrl, serviceKey } = config

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 4 MB)' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  const detected = detectImageType(new Uint8Array(buffer))
  if (!detected) {
    return NextResponse.json(
      { error: 'File must be a valid PNG, JPEG, or WEBP image' },
      { status: 400 },
    )
  }

  const ext = detected === 'jpeg' ? 'jpg' : detected
  const contentType = `image/${detected}`
  const path = `${actor.id}/${Date.now()}.${ext}`

  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/${ID_IMAGE_BUCKET}/${path}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    },
  )

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    console.error('Supabase Storage upload error:', errText)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const previous = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { idImagePath: true },
  })

  if (previous?.idImagePath && !(await deleteIdImage(previous.idImagePath))) {
    // Keep the old submission on record and discard the new upload instead.
    if (!(await deleteIdImage(path))) {
      console.error(`id-image: ORPHANED new upload ${path} for user ${actor.id} needs manual removal`)
    }
    return NextResponse.json(
      { error: "Couldn't replace your previous ID right now. Please try again." },
      { status: 502 },
    )
  }

  // A fresh submission always needs a fresh review, even if the account
  // was verified before (e.g. re-verifying with an updated document).
  await prisma.user.update({
    where: { id: actor.id },
    data: { idImagePath: path, verified: false, verifiedAt: null },
  })

  return NextResponse.json({ submitted: true })
}

/** Withdraw a pending ID submission. */
export async function DELETE(req: NextRequest) {
  const actor = await getActiveAuthUser(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const current = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { idImagePath: true },
  })
  if (!current?.idImagePath) {
    return NextResponse.json({ error: 'No ID submission to remove' }, { status: 404 })
  }

  // Only forget the path once the file is really gone.
  if (!(await deleteIdImage(current.idImagePath))) {
    return NextResponse.json(
      { error: "Couldn't remove your ID right now. Please try again." },
      { status: 502 },
    )
  }

  await prisma.user.update({
    where: { id: actor.id },
    data: { idImagePath: null, verified: false, verifiedAt: null },
  })

  return NextResponse.json({ submitted: false })
}
