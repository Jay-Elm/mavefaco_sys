import { NextRequest, NextResponse } from 'next/server'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'
import { rateLimit } from '@/lib/rateLimit'

type DetectedImageType = 'png' | 'jpeg' | 'webp'

/**
 * Sniffs the actual file bytes instead of trusting the client-supplied
 * `file.type`, which is attacker-controlled and easily spoofed. Also
 * excludes SVG on purpose — SVG can embed <script>, which is a stored-XSS
 * risk if the file is ever opened directly rather than rendered via <img>.
 */
function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return 'png'
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg'
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return 'webp'
  }
  return null
}

export async function POST(req: NextRequest) {
  const actor = await getActiveAuthUser(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, retryAfterSeconds } = rateLimit(`upload:${actor.id}`, 20, 60 * 60 * 1000)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many uploads. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // Vercel serverless limit is ~4.5 MB; stay under it
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

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }

  // Extension and content-type are derived from the sniffed bytes, not the
  // client-supplied filename/MIME type, so the stored object can't be
  // mislabeled by a crafted request.
  const ext = detected === 'jpeg' ? 'jpg' : detected
  const contentType = `image/${detected}`
  const filename = `${actor.id}_${Date.now()}.${ext}`

  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/product-images/${filename}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    }
  )

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    console.error('Supabase Storage upload error:', errText)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-images/${filename}`
  return NextResponse.json({ url: publicUrl })
}
