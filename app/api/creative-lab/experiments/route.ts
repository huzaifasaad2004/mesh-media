import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireCreativeWrite, serviceRole } from '@/lib/apiAuth'
import { emitAutomationEvent } from '@/lib/automations/engine'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'

const metrics = new Set(['ctr', 'conversions', 'cpa', 'roas', 'engagement_rate'])
const statuses = new Set(['draft', 'planned', 'running'])

export async function POST(req: NextRequest) {
  const auth = await requireCreativeWrite()
  if ('res' in auth) return auth.res
  const body = await req.json()
  const name = String(body.name ?? '').trim()
  const hypothesis = String(body.hypothesis ?? '').trim()
  if (!body.client_id || name.length < 2 || hypothesis.length < 8) {
    return NextResponse.json({ error: 'Client, experiment name, and a clear hypothesis are required' }, { status: 400 })
  }
  const { data: visibleClient } = await auth.db.from('clients').select('id, company_name').eq('id', body.client_id).maybeSingle()
  if (!visibleClient) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const db = serviceRole()
  if (body.project_id) {
    const { data: project } = await db.from('projects').select('id').eq('id', body.project_id).eq('client_id', body.client_id).maybeSingle()
    if (!project) return NextResponse.json({ error: 'Project does not belong to this client' }, { status: 400 })
  }
  const ensureProfile = async (profileId: string | null | undefined, creative: any) => {
    if (profileId) return profileId
    if (!creative?.provider || !creative?.external_ad_id) return null
    const { data, error } = await db.from('creative_profiles').upsert({
      client_id: body.client_id, project_id: body.project_id || null,
      provider: creative.provider, external_ad_id: String(creative.external_ad_id),
      display_name: String(creative.display_name ?? '').slice(0, 180) || null,
      thumbnail_url: String(creative.thumbnail_url ?? '').slice(0, 2000) || null,
      created_by: auth.user.id,
    }, { onConflict: 'client_id,provider,external_ad_id' }).select('id').single()
    if (error) throw error
    return data.id as string
  }
  let controlProfileId: string | null = null
  let variantProfileId: string | null = null
  try {
    controlProfileId = await ensureProfile(body.control_profile_id, body.control_creative)
    variantProfileId = await ensureProfile(body.variant_profile_id, body.variant_creative)
  } catch (profileError) {
    return NextResponse.json({ error: profileError instanceof Error ? profileError.message : 'Could not link the selected creatives' }, { status: 400 })
  }
  const profileIds = [controlProfileId, variantProfileId].filter(Boolean)
  if (profileIds.length) {
    const { data: profiles } = await db.from('creative_profiles').select('id').eq('client_id', body.client_id).in('id', profileIds)
    if ((profiles ?? []).length !== new Set(profileIds).size) return NextResponse.json({ error: 'Choose creatives belonging to this client' }, { status: 400 })
  }
  if (controlProfileId && controlProfileId === variantProfileId) {
    return NextResponse.json({ error: 'Control and variant must be different creatives' }, { status: 400 })
  }
  const ownerId = body.owner_id || null
  if (ownerId) {
    const { data: owner } = await db.from('profiles').select('id').eq('id', ownerId).neq('role', 'client').maybeSingle()
    if (!owner) return NextResponse.json({ error: 'Experiment owner is not a staff member' }, { status: 400 })
  }
  const { data: experiment, error } = await db.from('creative_experiments').insert({
    client_id: body.client_id,
    project_id: body.project_id || null,
    name: name.slice(0, 140),
    hypothesis: hypothesis.slice(0, 2000),
    control_profile_id: controlProfileId,
    variant_profile_id: variantProfileId,
    primary_metric: metrics.has(body.primary_metric) ? body.primary_metric : 'ctr',
    target_improvement: body.target_improvement === '' || body.target_improvement == null ? null : Number(body.target_improvement),
    status: statuses.has(body.status) ? body.status : 'planned',
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    owner_id: ownerId,
    created_by: auth.user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  let contentItemId: string | null = null
  if (body.create_approval && body.reviewer_id) {
    const { data: reviewer } = await db.from('profiles').select('id, role').eq('id', body.reviewer_id).maybeSingle()
    if (!reviewer || !MANAGERS.includes(reviewer.role)) {
      await db.from('creative_experiments').delete().eq('id', experiment.id)
      return NextResponse.json({ error: 'Choose a manager to review the test brief' }, { status: 400 })
    }
    const description = `${hypothesis}\n\nPrimary success metric: ${experiment.primary_metric.toUpperCase()}${experiment.target_improvement == null ? '' : ` · Target improvement: ${experiment.target_improvement}%`}`
    const { data: item, error: itemError } = await db.from('content_items').insert({
      client_id: body.client_id,
      project_id: body.project_id || null,
      title: `Creative test brief — ${experiment.name}`,
      description,
      created_by: auth.user.id,
      assigned_manager_id: reviewer.id,
      status: 'pending_manager',
    }).select('id').single()
    if (itemError) {
      await db.from('creative_experiments').delete().eq('id', experiment.id)
      return NextResponse.json({ error: itemError.message }, { status: 400 })
    }
    contentItemId = item.id
    await db.from('creative_experiments').update({ content_item_id: item.id }).eq('id', experiment.id)
    await notifyUsers(db, { userIds: [reviewer.id], title: 'Creative test brief needs review', body: `${experiment.name} · ${visibleClient.company_name}`, href: '/content', category: 'content_review' })
  }

  await logActivity(auth.user, 'create', 'creative_experiment', experiment.id, `${experiment.name} · ${visibleClient.company_name}`)
  await emitAutomationEvent('creative_test_created', {
    eventKey: experiment.id,
    actorId: auth.user.id,
    entityId: experiment.id,
    entityType: 'creative_experiment',
    clientId: body.client_id,
    projectId: body.project_id || null,
    values: { experiment_name: experiment.name, hypothesis: experiment.hypothesis, primary_metric: experiment.primary_metric, client_name: visibleClient.company_name },
  })
  return NextResponse.json({ ...experiment, content_item_id: contentItemId }, { status: 201 })
}
