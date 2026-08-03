import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRoles, serviceRole, stripProtected, MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  // RLS-scoped: staff see all, client-portal users only their own contracts
  const { data, error } = await auth.db
    .from('contracts')
    .select('*, client:clients(company_name), creator:profiles(full_name), document:signable_documents(id, title, status, file_url, merged_file_url)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
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
  const { data, error } = await serviceRole().from('contracts').insert({ ...body, created_by: auth.user.id }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'create', 'contract', data.id, data.title)
  return NextResponse.json(data)
}
