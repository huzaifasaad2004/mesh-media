import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getEffectivePermissions } from '@/lib/permissions'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = admin()
  const { data: profile } = await db.from('profiles').select('id, full_name, email, role, avatar_url').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const effective = await getEffectivePermissions(db, user.id, profile.role)
  return NextResponse.json({ ...profile, permissions: Array.from(effective) })
}

const MAX_AVATAR_BYTES = 3 * 1024 * 1024 // 3MB
const ALLOWED_MIME: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

// Self-service profile update — any authenticated person (staff or client) may
// change their own name/avatar. Body: { full_name?, avatar_base64?, avatar_mime? }
export async function PUT(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { full_name, avatar_base64, avatar_mime } = await req.json()
  const db = admin()
  const patch: Record<string, unknown> = {}

  if (typeof full_name === 'string') {
    if (!full_name.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
    patch.full_name = full_name.trim()
  }

  if (avatar_base64) {
    const ext = ALLOWED_MIME[avatar_mime]
    if (!ext) return NextResponse.json({ error: 'Unsupported image type — use PNG, JPEG, or WebP' }, { status: 400 })
    const buffer = Buffer.from(avatar_base64, 'base64')
    if (buffer.byteLength > MAX_AVATAR_BYTES) return NextResponse.json({ error: 'Image is too large (max 3MB)' }, { status: 400 })

    const path = `${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await db.storage.from('avatars').upload(path, buffer, { contentType: avatar_mime, upsert: false })
    if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

    const { data: publicUrl } = db.storage.from('avatars').getPublicUrl(path)
    patch.avatar_url = publicUrl.publicUrl
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await db.from('profiles').update(patch).eq('id', user.id).select('id, full_name, email, role, avatar_url').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
