import type { SupabaseClient } from '@supabase/supabase-js'

const n = (value: unknown) => Number(value ?? 0) || 0
const metricKeys = ['impressions', 'reach', 'clicks', 'engagements', 'video_views', 'leads', 'conversions', 'spend', 'revenue'] as const

function empty() {
  return { impressions: 0, reach: 0, clicks: 0, engagements: 0, video_views: 0, leads: 0, conversions: 0, spend: 0, revenue: 0 }
}

function add(target: Record<string, any>, row: Record<string, any>) {
  for (const key of metricKeys) target[key] = n(target[key]) + n(row[key])
  return target
}

export function withRates<T extends Record<string, any>>(item: T) {
  return {
    ...item,
    ctr: item.impressions ? item.clicks / item.impressions * 100 : 0,
    cpc: item.clicks ? item.spend / item.clicks : 0,
    cpm: item.impressions ? item.spend / item.impressions * 1000 : 0,
    conversionRate: item.clicks ? item.conversions / item.clicks * 100 : 0,
    cpa: item.conversions ? item.spend / item.conversions : 0,
    roas: item.spend ? item.revenue / item.spend : 0,
    frequency: item.reach ? item.impressions / item.reach : 0,
  }
}

export type CampaignReportQuery = {
  clientId: string
  projectId?: string | null
  start: string
  end: string
  provider?: string | null
  campaign?: string | null
  compare?: boolean
}

export async function getCampaignReportData(db: SupabaseClient, options: CampaignReportQuery) {
  let metrics = db.from('campaign_metrics_daily').select('*').eq('client_id', options.clientId)
    .gte('metric_date', options.start).lte('metric_date', options.end).order('metric_date')
  let ads = db.from('campaign_ad_metrics_daily').select('*').eq('client_id', options.clientId)
    .gte('metric_date', options.start).lte('metric_date', options.end)
  if (options.projectId) { metrics = metrics.eq('project_id', options.projectId); ads = ads.eq('project_id', options.projectId) }
  if (options.provider) { metrics = metrics.eq('provider', options.provider); ads = ads.eq('provider', options.provider) }
  if (options.campaign) { metrics = metrics.eq('external_campaign_id', options.campaign); ads = ads.eq('external_campaign_id', options.campaign) }

  const [{ data: rows, error }, { data: adRows, error: adError }] = await Promise.all([metrics, ads])
  if (error) throw error
  // Older environments can still show campaign reporting before the detail migration is applied.
  const detailRows = adError ? [] : (adRows ?? [])
  const totals = withRates((rows ?? []).reduce((total: any, row: any) => add(total, row), empty()))
  const group = (keyFor: (row: any) => string, seed: (row: any) => any) => Object.values((rows ?? []).reduce((acc: Record<string, any>, row: any) => {
    const key = keyFor(row); acc[key] = add(acc[key] ?? seed(row), row); return acc
  }, {})).map((item: any) => withRates(item))
  const byProvider = group(r => r.provider, r => ({ provider: r.provider, ...empty() }))
  const campaigns = group(r => `${r.provider}:${r.external_campaign_id}`, r => ({ provider: r.provider, id: r.external_campaign_id, name: r.campaign_name, ...empty() }))
    .sort((a: any, b: any) => b.spend - a.spend)
  const days = group(r => r.metric_date, r => ({ date: r.metric_date, ...empty() })).sort((a: any, b: any) => a.date.localeCompare(b.date))
  const creatives = Object.values(detailRows.reduce((acc: Record<string, any>, row: any) => {
    const key = `${row.provider}:${row.external_ad_id}`
    acc[key] = add(acc[key] ?? { provider: row.provider, campaignId: row.external_campaign_id, campaign: row.campaign_name, adGroup: row.ad_group_name, id: row.external_ad_id, name: row.ad_name, type: row.ad_type, status: row.ad_status, creative: row.creative, ...empty() }, row)
    return acc
  }, {})).map((item: any) => withRates(item)).sort((a: any, b: any) => b.spend - a.spend)

  let comparison: any = null
  if (options.compare) {
    const start = new Date(`${options.start}T00:00:00Z`), end = new Date(`${options.end}T00:00:00Z`)
    const duration = Math.round((end.getTime() - start.getTime()) / 86400000) + 1
    const previousEnd = new Date(start); previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
    const previousStart = new Date(previousEnd); previousStart.setUTCDate(previousStart.getUTCDate() - duration + 1)
    let previous = db.from('campaign_metrics_daily').select('*').eq('client_id', options.clientId)
      .gte('metric_date', previousStart.toISOString().slice(0, 10)).lte('metric_date', previousEnd.toISOString().slice(0, 10))
    if (options.projectId) previous = previous.eq('project_id', options.projectId)
    if (options.provider) previous = previous.eq('provider', options.provider)
    if (options.campaign) previous = previous.eq('external_campaign_id', options.campaign)
    const { data: previousRows } = await previous
    const previousTotals = withRates((previousRows ?? []).reduce((total: any, row: any) => add(total, row), empty()))
    const changes: Record<string, number | null> = {}
    for (const key of [...metricKeys, 'ctr', 'cpc', 'cpm', 'conversionRate', 'cpa', 'roas']) {
      changes[key] = previousTotals[key] ? (totals[key] - previousTotals[key]) / previousTotals[key] * 100 : totals[key] ? 100 : null
    }
    comparison = { start: previousStart.toISOString().slice(0, 10), end: previousEnd.toISOString().slice(0, 10), totals: previousTotals, changes }
  }
  return { totals, byProvider, campaigns, days, creatives, comparison }
}
