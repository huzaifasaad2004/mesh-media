import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'

export async function GET() {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const { data, error } = await serviceRole().from('campaign_connections')
    .select('id, client_id, project_id, provider, external_account_id, account_name, status, last_synced_at, last_error, created_at, client:clients(company_name), project:projects(name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({}))
  if (!['meta_ads', 'instagram', 'google_ads'].includes(body.provider) || !body.client_id || !body.external_account_id?.trim()) {
    return NextResponse.json({ error: 'Provider, client, and account ID are required' }, { status: 400 })
  }
  const db = serviceRole()
  if (body.project_id) {
    const { data: project } = await db.from('projects').select('id').eq('id', body.project_id).eq('client_id', body.client_id).maybeSingle()
    if (!project) return NextResponse.json({ error: 'Project does not belong to this client' }, { status: 400 })
  }
  const { data, error } = await db.from('campaign_connections').insert({
    provider: body.provider, client_id: body.client_id, project_id: body.project_id || null,
    external_account_id: body.external_account_id.trim(), account_name: body.account_name?.trim() || null,
    settings: body.login_customer_id ? { login_customer_id: body.login_customer_id.trim() } : {}, created_by: auth.user.id,
  }).select('id, provider, status').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
