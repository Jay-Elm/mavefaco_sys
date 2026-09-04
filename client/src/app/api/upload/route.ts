import { NextRequest, NextResponse } from 'next/server'
import { getActiveAuthUser } from '@/lib/getActiveAuthUser'

export async function POST(req: NextRequest) {
  const actor = await getActiveAuthUser(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
  }

  // Vercel serverless limit is ~4.5 MB; stay under it
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 4 MB)' }, { status: 400 })
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'Storage not configured' }, { status: 500 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
  const filename = `${actor.id}_${Date.now()}.${ext}`

  const buffer = await file.arrayBuffer()

  const uploadRes = await fetch(
    `${supabaseUrl}/storage/v1/object/product-images/${filename}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': file.type,
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
