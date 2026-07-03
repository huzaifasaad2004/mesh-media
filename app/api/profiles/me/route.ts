import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = admin()
  const { data: profile } = await db.from('profiles').select('id, full_name, email, role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    db.from('role_permissions').select('permission').eq('role', profile.role),
    db.from('user_permissions').select('permission, granted').eq('user_id', user.id),
  ])

  const effective = new Set((rolePerms ?? []).map(r => r.permission))
  for (const o of overrides ?? []) {
    if (o.granted) effective.add(o.permission)
    else effective.delete(o.permission)
  }

  return NextResponse.json({ ...profile, permissions: Array.from(effective) })
}
