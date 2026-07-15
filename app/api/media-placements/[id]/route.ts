import { NextRequest, NextResponse } from 'next/server'
import { requireMediaWrite, serviceRole, stripProtected, MANAGERS } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

const OUTLET_TYPES = ['print', 'online', 'tv', 'radio', 'podcast', 'social', 'other']
const PLACEMENT_TYPES = ['feature', 'mention', 'interview', 'byline', 'review', 'other']
const SENTIMENTS = ['positive', 'neutral', 'negative']

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireMediaWrite()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: existing } = await db.from('media_placements').select('id, client_id, title').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!MANAGERS.includes(auth.role)) {
    const { data: allowed } = await auth.db.rpc('my_assigned_client_ids')
    const allowedIds = new Set((allowed ?? []).map((r: any) => r.my_assigned_client_ids ?? r))
    if (!allowedIds.has(existing.client_id)) {
      return NextResponse.json({ error: 'You are not assigned to this client' }, { status: 403 })
    }
  }

  const body = stripProtected(await req.json())
  const patch: Record<string, unknown> = {}
  for (const key of ['title', 'outlet_name', 'url', 'publish_date', 'notes'] as const) {
    if (body[key] !== undefined) patch[key] = body[key] || null
  }
  if (body.outlet_type !== undefined) patch.outlet_type = OUTLET_TYPES.includes(body.outlet_type) ? body.outlet_type : 'online'
  if (body.placement_type !== undefined) patch.placement_type = PLACEMENT_TYPES.includes(body.placement_type) ? body.placement_type : 'mention'
  if (body.sentiment !== undefined) patch.sentiment = SENTIMENTS.includes(body.sentiment) ? body.sentiment : 'neutral'
  if (body.reach !== undefined) patch.reach = body.reach !== '' && body.reach != null ? Number(body.reach) : null
  if (body.ave !== undefined) patch.ave = body.ave !== '' && body.ave != null ? Number(body.ave) : null
  if (body.emv_multiplier !== undefined) patch.emv_multiplier = body.emv_multiplier !== '' && body.emv_multiplier != null ? Number(body.emv_multiplier) : 3.0

  const { data, error } = await db.from('media_placements').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'media_placement', params.id, data.title)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireMediaWrite()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: existing } = await db.from('media_placements').select('id, client_id, title, created_by').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!MANAGERS.includes(auth.role)) {
    // A member may only delete their own logged placements, for a client they're assigned to.
    const { data: allowed } = await auth.db.rpc('my_assigned_client_ids')
    const allowedIds = new Set((allowed ?? []).map((r: any) => r.my_assigned_client_ids ?? r))
    if (existing.created_by !== auth.user.id || !allowedIds.has(existing.client_id)) {
      return NextResponse.json({ error: 'You can only delete placements you logged yourself' }, { status: 403 })
    }
  }

  const { error } = await db.from('media_placements').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'media_placement', params.id, existing.title)
  return NextResponse.json({ success: true })
}
