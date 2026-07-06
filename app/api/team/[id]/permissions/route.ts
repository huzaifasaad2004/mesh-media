import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['owner', 'admin'].includes(me.role)) {
    return { error: NextResponse.json({ error: 'Admins only' }, { status: 403 }) }
  }
  return { userId: user.id, user }
}

// Effective = role defaults, with any per-user override taking precedence
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const db = admin()
  const [{ data: person }, { data: allPerms }, { data: rolePerms }, { data: overrides }] = await Promise.all([
    db.from('profiles').select('id, full_name, email, role').eq('id', params.id).single(),
    db.from('permissions').select('key, description').order('key'),
    db.from('role_permissions').select('permission'),
    db.from('user_permissions').select('permission, granted').eq('user_id', params.id),
  ])
  if (!person) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })

  const roleDefaultSet = new Set(
    (await db.from('role_permissions').select('permission').eq('role', person.role)).data?.map(r => r.permission) ?? []
  )
  const overrideMap = new Map((overrides ?? []).map(o => [o.permission, o.granted]))

  const permissions = (allPerms ?? []).map(p => ({
    key: p.key,
    description: p.description,
    role_default: roleDefaultSet.has(p.key),
    override: overrideMap.has(p.key) ? overrideMap.get(p.key) : null,
    effective: overrideMap.has(p.key) ? overrideMap.get(p.key) : roleDefaultSet.has(p.key),
  }))

  return NextResponse.json({ person, permissions })
}

// Body: { overrides: { [permissionKey]: true | false | null } }  (null clears the override)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requireAdmin()
  if (guard.error) return guard.error

  const { overrides } = await req.json()
  if (!overrides || typeof overrides !== 'object') {
    return NextResponse.json({ error: 'overrides object is required' }, { status: 400 })
  }

  const db = admin()
  const toUpsert: { user_id: string; permission: string; granted: boolean; updated_by: string }[] = []
  const toDelete: string[] = []

  for (const [key, value] of Object.entries(overrides)) {
    if (value === null) toDelete.push(key)
    else toUpsert.push({ user_id: params.id, permission: key, granted: Boolean(value), updated_by: guard.userId! })
  }

  const friendly = (msg: string) =>
    msg.includes('user_permissions')
      ? 'Per-person permissions need a one-time database setup that hasn\'t run yet. Ask your developer to run the pending migration.'
      : msg

  if (toUpsert.length) {
    const { error } = await db.from('user_permissions').upsert(toUpsert, { onConflict: 'user_id,permission' })
    if (error) return NextResponse.json({ error: friendly(error.message) }, { status: 400 })
  }
  if (toDelete.length) {
    const { error } = await db.from('user_permissions').delete().eq('user_id', params.id).in('permission', toDelete)
    if (error) return NextResponse.json({ error: friendly(error.message) }, { status: 400 })
  }

  if (guard.user) {
    await logActivity(guard.user, 'update', 'user_permissions', params.id, Object.keys(overrides).join(', '))
  }

  return NextResponse.json({ success: true })
}
