import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Uploads a base64 receipt image to the 'receipts' storage bucket and returns its public URL.
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { image_base64, mime_type } = await req.json()
  if (!image_base64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const mime = mime_type || 'image/jpeg'
  const ext = mime.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(image_base64, 'base64')

  const db = admin()
  const { error } = await db.storage.from('receipts').upload(path, buffer, { contentType: mime, upsert: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data } = db.storage.from('receipts').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
