import { NextRequest, NextResponse } from 'next/server'
import type { Role } from '@/lib/roles'
import { requireRoles, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

const TEAM_ADMINS: Role[] = ['owner', 'admin']
const EDITABLE_ROLES: Role[] = ['admin', 'manager', 'member', 'viewer']

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(TEAM_ADMINS)
  if ('res' in auth) return auth.res
  const db = serviceRole()
  const { data: target } = await db.from('profiles').select('id, role, email, full_name, archived_at').eq('id', params.id).single()
  if (!target) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'The owner account cannot be edited here' }, { status: 400 })

  const body = await req.json().catch(() => ({}))
  const patch: Record<string, unknown> = {}
  if (body.full_name !== undefined) {
    if (typeof body.full_name !== 'string' || !body.full_name.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    patch.full_name = body.full_name.trim()
  }
  if (body.role !== undefined) {
    if (!EDITABLE_ROLES.includes(body.role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    patch.role = body.role
  }

  if (body.restore === true) {
    patch.archived_at = null
    const unban = await db.auth.admin.updateUserById(params.id, { ban_duration: 'none' })
    if (unban.error) return NextResponse.json({ error: unban.error.message }, { status: 400 })
  }

  if (body.email !== undefined) {
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || !email.includes('@')) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
    const updatedAuth = await db.auth.admin.updateUserById(params.id, { email })
    if (updatedAuth.error) return NextResponse.json({ error: updatedAuth.error.message }, { status: 400 })
    patch.email = email
  }

  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  const { data, error } = await db.from('profiles').update(patch).eq('id', params.id).select('id, full_name, email, role, archived_at').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'team_member', params.id, data.full_name ?? data.email)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(TEAM_ADMINS)
  if ('res' in auth) return auth.res
  if (params.id === auth.user.id) return NextResponse.json({ error: 'You cannot remove your own access' }, { status: 400 })

  const db = serviceRole()
  const { data: target } = await db.from('profiles').select('id, role, email, full_name, archived_at').eq('id', params.id).single()
  if (!target) return NextResponse.json({ error: 'Team member not found' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'The owner account cannot be removed' }, { status: 400 })
  if (target.archived_at) return NextResponse.json({ success: true, archived: true })

  const banned = await db.auth.admin.updateUserById(params.id, { ban_duration: '876000h' })
  if (banned.error) return NextResponse.json({ error: banned.error.message }, { status: 400 })
  const { error } = await db.from('profiles').update({ archived_at: new Date().toISOString() }).eq('id', params.id)
  if (error) {
    await db.auth.admin.updateUserById(params.id, { ban_duration: 'none' })
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  await logActivity(auth.user, 'archive', 'team_member', params.id, target.full_name ?? target.email)
  return NextResponse.json({ success: true, archived: true })
}
