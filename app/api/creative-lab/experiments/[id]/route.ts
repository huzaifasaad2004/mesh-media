import { NextRequest, NextResponse } from 'next/server'
import { requireCreativeWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

const statuses = new Set(['draft', 'planned', 'running', 'won', 'lost', 'inconclusive', 'cancelled'])
const metrics = new Set(['ctr', 'conversions', 'cpa', 'roas', 'engagement_rate'])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireCreativeWrite()
  if ('res' in auth) return auth.res
  const db = serviceRole()
  const { data: existing } = await db.from('creative_experiments').select('id, client_id, name').eq('id', params.id).maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Experiment not found' }, { status: 404 })
  const { data: visibleClient } = await auth.db.from('clients').select('id').eq('id', existing.client_id).maybeSingle()
  if (!visibleClient) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const body = await req.json()
  const update: Record<string, any> = {}
  if (body.name !== undefined) update.name = String(body.name).trim().slice(0, 140)
  if (body.hypothesis !== undefined) update.hypothesis = String(body.hypothesis).trim().slice(0, 2000)
  if (body.status !== undefined && statuses.has(body.status)) update.status = body.status
  if (body.primary_metric !== undefined && metrics.has(body.primary_metric)) update.primary_metric = body.primary_metric
  for (const field of ['start_date', 'end_date', 'owner_id', 'control_profile_id', 'variant_profile_id']) {
    if (body[field] !== undefined) update[field] = body[field] || null
  }
  if (body.target_improvement !== undefined) update.target_improvement = body.target_improvement === '' || body.target_improvement == null ? null : Number(body.target_improvement)
  if (body.result_summary !== undefined) update.result_summary = String(body.result_summary).trim().slice(0, 4000) || null
  if (body.decision !== undefined) update.decision = String(body.decision).trim().slice(0, 4000) || null
  if (!Object.keys(update).length) return NextResponse.json({ error: 'No supported changes supplied' }, { status: 400 })
  const { data, error } = await db.from('creative_experiments').update(update).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'creative_experiment', data.id, data.name)
  return NextResponse.json(data)
}
