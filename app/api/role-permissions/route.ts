import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { STAFF_ROLES } from '@/lib/roles'

// Owner/admin only — this edits the role defaults every user of that role inherits.
export async function GET() {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const [{ data: permissions }, { data: rolePerms }] = await Promise.all([
    db.from('permissions').select('key, description').order('key'),
    db.from('role_permissions').select('role, permission'),
  ])

  const grid = new Set((rolePerms ?? []).map((r) => `${r.role}:${r.permission}`))

  return NextResponse.json({
    roles: STAFF_ROLES,
    permissions: permissions ?? [],
    grid: Array.from(grid),
  })
}

// Body: { role, permission, granted }
export async function PUT(req: NextRequest) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  const { role, permission, granted } = await req.json()
  if (!role || !permission || typeof granted !== 'boolean') {
    return NextResponse.json({ error: 'role, permission, and granted are required' }, { status: 400 })
  }
  if (!STAFF_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  const db = serviceRole()
  if (granted) {
    const { error } = await db.from('role_permissions').upsert({ role, permission }, { onConflict: 'role,permission' })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  } else {
    const { error } = await db.from('role_permissions').delete().eq('role', role).eq('permission', permission)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  await logActivity(auth.user, granted ? 'grant' : 'revoke', 'role_permission', null, `${permission} for ${role}`)

  return NextResponse.json({ success: true })
}
