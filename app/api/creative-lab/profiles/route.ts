import { NextRequest, NextResponse } from 'next/server'
import { requireCreativeWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

const providers = new Set(['meta_ads', 'instagram', 'google_ads'])
const lifecycleStatuses = new Set(['active', 'paused', 'retired'])
const fingerprintFields = new Set(['format', 'hook', 'angle', 'offer', 'cta', 'visualStyle'])

export async function PUT(req: NextRequest) {
  const auth = await requireCreativeWrite()
  if ('res' in auth) return auth.res
  const body = await req.json()
  if (!body.client_id || !providers.has(body.provider) || !String(body.external_ad_id ?? '').trim()) {
    return NextResponse.json({ error: 'Client, provider, and advertising asset are required' }, { status: 400 })
  }
  const { data: visibleClient } = await auth.db.from('clients').select('id').eq('id', body.client_id).maybeSingle()
  if (!visibleClient) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  if (body.project_id) {
    const { data: project } = await auth.db.from('projects').select('id').eq('id', body.project_id).eq('client_id', body.client_id).maybeSingle()
    if (!project) return NextResponse.json({ error: 'Project does not belong to this client' }, { status: 400 })
  }
  const fingerprint = Object.fromEntries(Object.entries(body.fingerprint ?? {})
    .filter(([key]) => fingerprintFields.has(key))
    .map(([key, value]) => [key, String(value ?? '').trim().slice(0, 160) || null]))
  const lifecycleStatus = lifecycleStatuses.has(body.lifecycle_status) ? body.lifecycle_status : 'active'
  const db = serviceRole()
  const { data, error } = await db.from('creative_profiles').upsert({
    client_id: body.client_id,
    project_id: body.project_id || null,
    provider: body.provider,
    external_ad_id: String(body.external_ad_id).trim(),
    display_name: String(body.display_name ?? '').trim().slice(0, 180) || null,
    thumbnail_url: String(body.thumbnail_url ?? '').trim().slice(0, 2000) || null,
    fingerprint,
    notes: String(body.notes ?? '').trim().slice(0, 4000) || null,
    lifecycle_status: lifecycleStatus,
    created_by: auth.user.id,
  }, { onConflict: 'client_id,provider,external_ad_id' }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'creative_profile', data.id, data.display_name || data.external_ad_id)
  return NextResponse.json(data)
}
