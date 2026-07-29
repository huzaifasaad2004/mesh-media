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

  let targetsQuery = db.from('campaign_targets').select('*').eq('client_id', options.clientId).lte('period_start', options.end).gte('period_end', options.start)
  if (options.projectId) targetsQuery = targetsQuery.eq('project_id', options.projectId)
  const [{ data: rows, error }, { data: adRows, error: adError }, { data: targets }, { data: crmLeads }] = await Promise.all([
    metrics, ads, targetsQuery,
    db.from('leads').select('id,status,estimated_value,source,created_at').eq('converted_client_id', options.clientId).gte('created_at', `${options.start}T00:00:00Z`).lte('created_at', `${options.end}T23:59:59Z`),
  ])
  if (error) throw error
  // Older environments can still show campaign reporting before the detail migration is applied.
  const detailRows = adError ? [] : (adRows ?? [])
  const totals = withRates((rows ?? []).reduce((total: any, row: any) => add(total, row), empty()))
  const group = (keyFor: (row: any) => string, seed: (row: any) => any) => Object.values((rows ?? []).reduce((acc: Record<string, any>, row: any) => {
    const key = keyFor(row); acc[key] = add(acc[key] ?? seed(row), row); return acc
  }, {})).map((item: any) => withRates(item))
  const byProvider = group(r => r.provider, r => ({ provider: r.provider, ...empty() }))
  const campaigns = group(r => `${r.provider}:${r.external_campaign_id}`, r => ({ provider: r.provider, id: r.external_campaign_id, name: r.campaign_name, ...empty() }))
    .map((c: any) => {
      const ctrScore = totals.ctr ? Math.min(120, c.ctr / totals.ctr * 100) : 50
      const cpaScore = totals.cpa && c.cpa ? Math.min(120, totals.cpa / c.cpa * 100) : 50
      const roasScore = totals.roas ? Math.min(120, c.roas / totals.roas * 100) : 50
      return { ...c, qualityScore: Math.round(Math.min(100, ctrScore * .35 + cpaScore * .35 + roasScore * .3)) }
    }).sort((a: any, b: any) => b.spend - a.spend)
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
  const target = targets?.[0] ?? null
  const startDate = new Date(`${options.start}T00:00:00Z`), endDate = new Date(`${options.end}T00:00:00Z`)
  const elapsedDays = Math.max(1, Math.round((Math.min(Date.now(), endDate.getTime()) - startDate.getTime()) / 86400000) + 1)
  const totalDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1)
  const forecast = { spend: totals.spend / elapsedDays * totalDays, conversions: totals.conversions / elapsedDays * totalDays, revenue: totals.revenue / elapsedDays * totalDays }
  const budget = Number(target?.budget ?? 0), expectedSpend = budget ? budget * Math.min(1, elapsedDays / totalDays) : 0
  const pacing = budget ? { budget, spent: totals.spend, remaining: budget - totals.spend, expectedSpend, variance: expectedSpend ? (totals.spend - expectedSpend) / expectedSpend * 100 : 0, forecastSpend: forecast.spend } : null
  const alerts: Array<{ severity: 'low'|'medium'|'high'; title: string; message: string }> = []
  if (pacing && pacing.variance > 15) alerts.push({ severity:'medium', title:'Budget pacing high', message:`Spend is ${pacing.variance.toFixed(0)}% ahead of planned pace.` })
  if (pacing && pacing.variance < -15) alerts.push({ severity:'low', title:'Budget pacing low', message:`Spend is ${Math.abs(pacing.variance).toFixed(0)}% behind planned pace.` })
  if (comparison?.changes?.ctr != null && comparison.changes.ctr < -15) alerts.push({ severity:'medium', title:'CTR declined', message:`Click-through rate fell ${Math.abs(comparison.changes.ctr).toFixed(0)}% versus the prior period.` })
  if (comparison?.changes?.cpa != null && comparison.changes.cpa > 20) alerts.push({ severity:'medium', title:'Cost per result increased', message:`CPA increased ${comparison.changes.cpa.toFixed(0)}% versus the prior period.` })
  for (const c of campaigns.filter((x: any) => x.spend > totals.spend * .1 && x.qualityScore < 45).slice(0, 3) as any[]) alerts.push({ severity:'high', title:`Review ${c.name}`, message:`This campaign uses meaningful budget but has a ${c.qualityScore}/100 efficiency score.` })
  const won = (crmLeads ?? []).filter((l: any) => l.status === 'won')
  const qualified = (crmLeads ?? []).filter((l: any) => ['qualified','proposal','negotiation','won'].includes(l.status))
  const crm = { totalLeads:crmLeads?.length ?? 0, qualifiedLeads:qualified.length, wonLeads:won.length, wonValue:won.reduce((s:number,l:any)=>s+n(l.estimated_value),0), pipelineValue:(crmLeads ?? []).reduce((s:number,l:any)=>s+n(l.estimated_value),0), sources:Object.entries((crmLeads ?? []).reduce((a:Record<string,number>,l:any)=>{a[l.source||'Unknown']=(a[l.source||'Unknown']??0)+1;return a},{})).map(([source,count])=>({source,count})) }
  return { totals, byProvider, campaigns, days, creatives, comparison, target, forecast, pacing, alerts, crm }
}
