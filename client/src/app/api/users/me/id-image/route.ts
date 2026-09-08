import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { rateLimit } from '@/lib/rateLimit'
import { detectImageType } from '@/lib/imageSniff'

const BUCKET = 'id-verification'

function storageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) return null
  return { supabaseUrl, serviceKey }
}

/** Best-effort delete — never blocks the caller on a storage hiccup. */
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
    console.error('id-image: failed to delete old object', err)
  }
}

/**
 * Uploads a government ID into the private "id-verification" bucket —
 * never a public bucket — and records only the storage path, not a URL.
 * Admins view it later via a short-lived signed URL
 * (GET /api/admin/users/[id]/id-image), never a permanently public link.
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
    `${supabaseUrl}/storage/v1/object/${BUCKET}/${path}`,
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

  // A fresh submission always needs a fresh review, even if the account
  // was verified before (e.g. re-verifying with an updated document).
  await prisma.user.update({
    where: { id: actor.id },
    data: { idImagePath: path, verified: false },
  })

  if (previous?.idImagePath) {
    await deleteObject(supabaseUrl, serviceKey, previous.idImagePath)
  }

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

  await prisma.user.update({
    where: { id: actor.id },
    data: { idImagePath: null, verified: false },
  })

  const config = storageConfig()
  if (config) {
    await deleteObject(config.supabaseUrl, config.serviceKey, current.idImagePath)
  }

  return NextResponse.json({ submitted: false })
}
