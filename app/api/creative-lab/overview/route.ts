import { NextRequest, NextResponse } from 'next/server'
import { requireCreativeRead, serviceRole } from '@/lib/apiAuth'
import { hasPermission } from '@/lib/permissions'
import { isAdmin } from '@/lib/roles'
import { loadCreativeIntelligence } from '@/lib/creativeLab'

const isoDate = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  const auth = await requireCreativeRead()
  if ('res' in auth) return auth.res
  const clientId = req.nextUrl.searchParams.get('client')
  const projectId = req.nextUrl.searchParams.get('project')
  const provider = req.nextUrl.searchParams.get('provider')
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')
  if (!clientId || !start || !end || !isoDate.test(start) || !isoDate.test(end) || end < start) {
    return NextResponse.json({ error: 'A valid client and date range are required' }, { status: 400 })
  }

  const { data: visibleClient } = await auth.db.from('clients').select('id, company_name').eq('id', clientId).maybeSingle()
  if (!visibleClient) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const db = serviceRole()
  let experimentsQuery = db.from('creative_experiments').select('*, owner:profiles!creative_experiments_owner_id_fkey(id,full_name,email), control:creative_profiles!creative_experiments_control_profile_id_fkey(id,display_name,provider,external_ad_id), variant:creative_profiles!creative_experiments_variant_profile_id_fkey(id,display_name,provider,external_ad_id)').eq('client_id', clientId).order('created_at', { ascending: false })
  if (projectId) experimentsQuery = experimentsQuery.eq('project_id', projectId)

  const [intelligence, { data: experiments, error: experimentError }, { data: staff }] = await Promise.all([
    loadCreativeIntelligence(db, { clientId, projectId, provider, start, end }),
    experimentsQuery,
    db.from('profiles').select('id, full_name, email, role').neq('role', 'client').order('full_name'),
  ])
  if (!intelligence.migrationReady || experimentError) {
    return NextResponse.json({ error: 'Creative Lab database migration has not been applied yet' }, { status: 409 })
  }

  const canWrite = isAdmin(auth.role) || await hasPermission(db, auth.user.id, auth.role, 'creative.write')
  const runningExperiments = (experiments ?? []).filter((experiment: any) => ['planned', 'running'].includes(experiment.status)).length
  if (!intelligence.recommendations.length && !(experiments ?? []).length) intelligence.recommendations.push({
    type: 'experiment', priority: 'medium', title: 'Create the first controlled creative test',
    detail: 'Choose one strong control, change one element, and agree on the winning metric before launch.',
  })

  return NextResponse.json({
    ...intelligence,
    experiments: experiments ?? [],
    staff: canWrite ? staff ?? [] : [],
    canWrite,
    summary: { ...intelligence.summary, runningExperiments },
  })
}
