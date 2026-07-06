import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, stripProtected, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('tasks').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'task', params.id, data.title)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res
  const { data: existing } = await serviceRole().from('tasks').select('title').eq('id', params.id).single()
  const { error } = await serviceRole().from('tasks').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'task', params.id, existing?.title)
  return NextResponse.json({ success: true })
}
