import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { getCampaignReportData } from '@/lib/campaignReportData'

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const clientId = req.nextUrl.searchParams.get('client')
  const projectId = req.nextUrl.searchParams.get('project')
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')
  const provider = req.nextUrl.searchParams.get('provider')
  const campaign = req.nextUrl.searchParams.get('campaign')
  const compare = req.nextUrl.searchParams.get('compare') === 'true'
  if (!clientId || !start || !end) return NextResponse.json({ error: 'Client and date range are required' }, { status: 400 })

  // First prove the caller can see this client through RLS. The service-role
  // aggregation below is then safely scoped to the verified client ID.
  const { data: visibleClient } = await auth.db.from('clients').select('id').eq('id', clientId).maybeSingle()
  if (!visibleClient) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const db = serviceRole()
  try {
    const report = await getCampaignReportData(db, { clientId, projectId, start, end, provider, campaign, compare })
    let targetsQuery = db.from('campaign_targets').select('*').eq('client_id', clientId).lte('period_start', end).gte('period_end', start)
    if (projectId) targetsQuery = targetsQuery.eq('project_id', projectId)
    const { data: targets } = await targetsQuery
    return NextResponse.json({ ...report, targets: targets ?? [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not build report' }, { status: 400 })
  }
}
