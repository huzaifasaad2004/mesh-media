import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole, stripProtected, MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  if (body.signable_document_id) {
    const { data: document } = await serviceRole().from('signable_documents').select('status').eq('id', body.signable_document_id).maybeSingle()
    if (document?.status === 'signed') {
      body.status = 'signed'
      body.signed_at = new Date().toISOString()
    }
  }
  const { data, error } = await serviceRole().from('contracts').update(body).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'contract', params.id, data.title)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const { data: existing } = await serviceRole().from('contracts').select('title').eq('id', params.id).single()
  const { error } = await serviceRole().from('contracts').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'contract', params.id, existing?.title)
  return NextResponse.json({ success: true })
}
