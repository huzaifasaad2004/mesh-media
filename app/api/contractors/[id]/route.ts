import { NextRequest, NextResponse } from 'next/server'
import { requireContractorsRead, requireContractorsWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireContractorsRead()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const [{ data: contractor, error }, { data: payments }, { data: files }] = await Promise.all([
    db.from('contractors').select('*').eq('id', params.id).single(),
    db.from('contractor_payments').select('*, project:projects(name)').eq('contractor_id', params.id).order('payment_date', { ascending: false }),
    db.from('files').select('*').eq('contractor_id', params.id).order('created_at', { ascending: false }),
  ])
  if (error || !contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })
  return NextResponse.json({ ...contractor, payments: payments ?? [], files: files ?? [] })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireContractorsWrite()
  if ('res' in auth) return auth.res

  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('contractors').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'contractor', params.id, data.name)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireContractorsWrite()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: existing } = await db.from('contractors').select('name').eq('id', params.id).single()
  const { error } = await db.from('contractors').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'contractor', params.id, existing?.name)
  return NextResponse.json({ success: true })
}
