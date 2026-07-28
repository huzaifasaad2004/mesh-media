import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const clientId = req.nextUrl.searchParams.get('client')
  const projectId = req.nextUrl.searchParams.get('project')
  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')
  if (!clientId || !start || !end) return NextResponse.json({ error: 'Client and date range are required' }, { status: 400 })

  // First prove the caller can see this client through RLS. The service-role
  // aggregation below is then safely scoped to the verified client ID.
  const { data: visibleClient } = await auth.db.from('clients').select('id').eq('id', clientId).maybeSingle()
  if (!visibleClient) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  const db = serviceRole()
  let query = db.from('campaign_metrics_daily').select('*').eq('client_id', clientId).gte('metric_date', start).lte('metric_date', end).order('metric_date')
  if (projectId) query = query.eq('project_id', projectId)
  const [{ data: rows, error }, { data: targets }] = await Promise.all([
    query,
    db.from('campaign_targets').select('*').eq('client_id', clientId).lte('period_start', end).gte('period_end', start),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const sum = (key: string) => (rows ?? []).reduce((total, row: any) => total + Number(row[key] ?? 0), 0)
  const totals = { impressions: sum('impressions'), reach: sum('reach'), clicks: sum('clicks'), engagements: sum('engagements'), video_views: sum('video_views'), leads: sum('leads'), conversions: sum('conversions'), spend: sum('spend'), revenue: sum('revenue') }
  const byProvider = Object.values((rows ?? []).reduce((acc: Record<string, any>, row: any) => {
    const item = acc[row.provider] ?? { provider: row.provider, impressions: 0, reach: 0, clicks: 0, engagements: 0, leads: 0, conversions: 0, spend: 0, revenue: 0 }
    for (const key of ['impressions', 'reach', 'clicks', 'engagements', 'leads', 'conversions', 'spend', 'revenue']) item[key] += Number(row[key] ?? 0)
    acc[row.provider] = item; return acc
  }, {}))
  const campaigns = Object.values((rows ?? []).reduce((acc: Record<string, any>, row: any) => {
    const key = `${row.provider}:${row.external_campaign_id}`
    const item = acc[key] ?? { provider: row.provider, id: row.external_campaign_id, name: row.campaign_name, impressions: 0, clicks: 0, leads: 0, conversions: 0, spend: 0, revenue: 0 }
    for (const metric of ['impressions', 'clicks', 'leads', 'conversions', 'spend', 'revenue']) item[metric] += Number(row[metric] ?? 0)
    acc[key] = item; return acc
  }, {})).sort((a: any, b: any) => b.spend - a.spend)
  return NextResponse.json({ totals, byProvider, campaigns, targets: targets ?? [], days: rows ?? [] })
}
