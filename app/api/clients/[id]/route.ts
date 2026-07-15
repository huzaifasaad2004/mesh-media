import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, stripProtected, MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('clients').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'client', params.id, data.company_name)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const { data: existing } = await serviceRole().from('clients').select('company_name').eq('id', params.id).single()
  const { error } = await serviceRole().from('clients').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'client', params.id, existing?.company_name)
  return NextResponse.json({ success: true })
}
