import { NextRequest, NextResponse } from 'next/server'
import { requireMediaRead, requireMediaWrite, serviceRole, stripProtected, MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

const OUTLET_TYPES = ['print', 'online', 'tv', 'radio', 'podcast', 'social', 'other']
const PLACEMENT_TYPES = ['feature', 'mention', 'interview', 'byline', 'review', 'other']
const SENTIMENTS = ['positive', 'neutral', 'negative']

// RLS-scoped: managers+/viewer see everything, a member sees only placements
// for clients they're assigned to, a client-portal user sees their own.
export async function GET() {
  const auth = await requireMediaRead()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('media_placements')
    .select('*, client:clients(company_name), project:projects(name), creator:profiles(full_name)')
    .order('publish_date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { client_id, project_id?, title, outlet_name, outlet_type?, placement_type?,
//         sentiment?, url?, publish_date?, reach?, ave?, emv_multiplier?, notes? }
export async function POST(req: NextRequest) {
  const auth = await requireMediaWrite()
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { client_id, title, outlet_name } = body as { client_id?: string; title?: string; outlet_name?: string }
  if (!client_id || !title || !outlet_name) {
    return NextResponse.json({ error: 'client_id, title, and outlet_name are required' }, { status: 400 })
  }

  // A member may only log coverage for a client they're actually assigned
  // to — mirrors the same check on content submissions.
  if (!MANAGERS.includes(auth.role)) {
    const { data: allowed } = await auth.db.rpc('my_assigned_client_ids')
    const allowedIds = new Set((allowed ?? []).map((r: any) => r.my_assigned_client_ids ?? r))
    if (!allowedIds.has(client_id)) {
      return NextResponse.json({ error: 'You are not assigned to this client' }, { status: 403 })
    }
  }

  const db = serviceRole()
  const { data, error } = await db.from('media_placements').insert({
    client_id,
    project_id: body.project_id || null,
    title,
    outlet_name,
    outlet_type: OUTLET_TYPES.includes(body.outlet_type) ? body.outlet_type : 'online',
    placement_type: PLACEMENT_TYPES.includes(body.placement_type) ? body.placement_type : 'mention',
    sentiment: SENTIMENTS.includes(body.sentiment) ? body.sentiment : 'neutral',
    url: body.url || null,
    publish_date: body.publish_date || new Date().toISOString().split('T')[0],
    reach: body.reach != null && body.reach !== '' ? Number(body.reach) : null,
    ave: body.ave != null && body.ave !== '' ? Number(body.ave) : null,
    emv_multiplier: body.emv_multiplier != null && body.emv_multiplier !== '' ? Number(body.emv_multiplier) : 3.0,
    notes: body.notes || null,
    created_by: auth.user.id,
  }).select('*, client:clients(company_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'media_placement', data.id, `${title} · ${data.client?.company_name ?? ''}`)
  return NextResponse.json(data)
}
