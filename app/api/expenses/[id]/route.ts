import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, stripProtected, FINANCE_WRITE } from '@/lib/apiAuth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(FINANCE_WRITE, 'finance.write')
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('expenses').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(FINANCE_WRITE, 'finance.write')
  if ('res' in auth) return auth.res
  const { error } = await serviceRole().from('expenses').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
