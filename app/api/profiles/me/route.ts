import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getEffectivePermissions } from '@/lib/permissions'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = admin()
  const { data: profile } = await db.from('profiles').select('id, full_name, email, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const effective = await getEffectivePermissions(db, user.id, profile.role)
  return NextResponse.json({ ...profile, permissions: Array.from(effective) })
}
