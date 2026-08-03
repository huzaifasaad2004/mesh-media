import type { SupabaseClient } from '@supabase/supabase-js'

export type CreativeMetricRow = {
  client_id?: string
  project_id?: string | null
  provider: string
  external_campaign_id?: string
  campaign_name?: string
  external_ad_group_id?: string | null
  ad_group_name?: string | null
  external_ad_id: string
  ad_name?: string | null
  ad_type?: string | null
  ad_status?: string | null
  metric_date?: string
  impressions?: number | string | null
  clicks?: number | string | null
  engagements?: number | string | null
  video_views?: number | string | null
  conversions?: number | string | null
  spend?: number | string | null
  revenue?: number | string | null
  creative?: Record<string, any> | null
}

export type CreativeProfile = {
  id: string
  client_id: string
  project_id?: string | null
  provider: string
  external_ad_id: string
  display_name?: string | null
  thumbnail_url?: string | null
  fingerprint?: Record<string, string | null>
  notes?: string | null
  lifecycle_status?: string
}

const metricKeys = ['impressions', 'clicks', 'engagements', 'video_views', 'conversions', 'spend', 'revenue'] as const
const number = (value: unknown) => Number(value ?? 0) || 0
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value))
const change = (current: number, previous: number) => previous ? (current - previous) / previous * 100 : current ? 100 : null

const emptyMetrics = () => ({ impressions: 0, clicks: 0, engagements: 0, video_views: 0, conversions: 0, spend: 0, revenue: 0 })

function addMetrics(target: Record<string, any>, row: CreativeMetricRow) {
  for (const key of metricKeys) target[key] = number(target[key]) + number(row[key])
  return target
}

function withRates<T extends Record<string, any>>(item: T) {
  return {
    ...item,
    ctr: item.impressions ? item.clicks / item.impressions * 100 : 0,
    engagementRate: item.impressions ? item.engagements / item.impressions * 100 : 0,
    conversionRate: item.clicks ? item.conversions / item.clicks * 100 : 0,
    cpa: item.conversions ? item.spend / item.conversions : 0,
    roas: item.spend ? item.revenue / item.spend : 0,
  }
}

function groupRows(rows: CreativeMetricRow[]) {
  return Object.values(rows.reduce<Record<string, any>>((groups, row) => {
    const key = `${row.provider}:${row.external_ad_id}`
    const creative = row.creative ?? {}
    groups[key] = addMetrics(groups[key] ?? {
      key,
      clientId: row.client_id,
      projectId: row.project_id,
      provider: row.provider,
      externalAdId: row.external_ad_id,
      campaignId: row.external_campaign_id,
      campaign: row.campaign_name,
      adGroupId: row.external_ad_group_id,
      adGroup: row.ad_group_name,
      name: row.ad_name,
      type: row.ad_type,
      status: row.ad_status,
      creative,
      firstDate: row.metric_date,
      lastDate: row.metric_date,
      ...emptyMetrics(),
    }, row)
    if (row.metric_date && (!groups[key].firstDate || row.metric_date < groups[key].firstDate)) groups[key].firstDate = row.metric_date
    if (row.metric_date && (!groups[key].lastDate || row.metric_date > groups[key].lastDate)) groups[key].lastDate = row.metric_date
    if (!groups[key].creative || !Object.keys(groups[key].creative).length) groups[key].creative = creative
    return groups
  }, {})).map(withRates)
}

function ratioScore(value: number, benchmark: number, inverse = false) {
  if (!benchmark) return 50
  if (!value) return inverse ? 20 : 0
  const ratio = inverse ? benchmark / value : value / benchmark
  return clamp(50 * ratio, 10, 100)
}

function inferredFingerprint(item: any) {
  const type = String(item.type ?? '').toLowerCase()
  const format = type.includes('video') ? 'Video' : type.includes('image') ? 'Static image' : type.includes('responsive') ? 'Responsive' : item.type || null
  return { format }
}

export function buildCreativeIntelligence(currentRows: CreativeMetricRow[], previousRows: CreativeMetricRow[], profiles: CreativeProfile[]) {
  const current = groupRows(currentRows)
  const previous = new Map(groupRows(previousRows).map(item => [item.key, item]))
  const profileMap = new Map(profiles.map(profile => [`${profile.provider}:${profile.external_ad_id}`, profile]))
  const benchmark = withRates(current.reduce((totals, item) => addMetrics(totals, item), emptyMetrics()))

  const creatives = current.map(item => {
    const prior = previous.get(item.key) ?? withRates(emptyMetrics())
    const profile = profileMap.get(item.key)
    const score = Math.round(
      ratioScore(item.ctr, benchmark.ctr) * .35 +
      ratioScore(item.conversionRate, benchmark.conversionRate) * .25 +
      ratioScore(item.cpa, benchmark.cpa, true) * .25 +
      ratioScore(item.roas, benchmark.roas) * .15
    )
    const ctrChange = change(item.ctr, prior.ctr)
    const cpaChange = change(item.cpa, prior.cpa)
    const fatigueReasons: string[] = []
    if (item.impressions >= 500 && prior.impressions >= 500 && ctrChange != null && ctrChange <= -20) fatigueReasons.push(`CTR fell ${Math.abs(ctrChange).toFixed(0)}%`)
    if (item.spend >= 100 && prior.spend >= 100 && cpaChange != null && cpaChange >= 25) fatigueReasons.push(`cost per result rose ${cpaChange.toFixed(0)}%`)
    if (item.impressions >= 2500 && item.conversions === 0) fatigueReasons.push('high delivery without a conversion')
    const creative = item.creative ?? {}
    const fingerprint = { ...inferredFingerprint(item), ...(profile?.fingerprint ?? {}) }
    const populatedFingerprint = Object.values(fingerprint).filter(Boolean).length
    return {
      ...item,
      profileId: profile?.id ?? null,
      name: profile?.display_name || creative.title || item.name || `Ad ${item.externalAdId}`,
      thumbnailUrl: profile?.thumbnail_url || creative.thumbnailUrl || creative.imageUrl || null,
      body: creative.body || creative.description || null,
      fingerprint,
      fingerprintCompleteness: Math.round(populatedFingerprint / 6 * 100),
      notes: profile?.notes ?? null,
      lifecycleStatus: profile?.lifecycle_status ?? 'active',
      previous: prior,
      changes: { ctr: ctrChange, cpa: cpaChange, conversions: change(item.conversions, prior.conversions), roas: change(item.roas, prior.roas) },
      score,
      confidence: item.impressions >= 5000 ? 'high' : item.impressions >= 1000 ? 'medium' : 'low',
      fatigued: fatigueReasons.length > 0,
      fatigueReasons,
    }
  }).sort((a, b) => b.score - a.score || b.spend - a.spend)

  const patternFields = ['format', 'hook', 'angle', 'offer', 'cta', 'visualStyle'] as const
  const patternGroups = new Map<string, { field: string; value: string; creatives: any[] }>()
  for (const creative of creatives) {
    for (const field of patternFields) {
      const value = String(creative.fingerprint?.[field] ?? '').trim()
      if (!value) continue
      const key = `${field}:${value.toLowerCase()}`
      const group = patternGroups.get(key) ?? { field, value, creatives: [] }
      group.creatives.push(creative)
      patternGroups.set(key, group)
    }
  }
  const averageScore = creatives.length ? creatives.reduce((sum, item) => sum + item.score, 0) / creatives.length : 0
  const patterns = Array.from(patternGroups.values()).map(group => {
    const score = group.creatives.reduce((sum: number, item: any) => sum + item.score, 0) / group.creatives.length
    return {
      field: group.field,
      value: group.value,
      count: group.creatives.length,
      score: Math.round(score),
      scoreLift: Math.round(score - averageScore),
      spend: group.creatives.reduce((sum: number, item: any) => sum + item.spend, 0),
      conversions: group.creatives.reduce((sum: number, item: any) => sum + item.conversions, 0),
      confidence: group.creatives.length >= 3 ? 'high' : group.creatives.length === 2 ? 'medium' : 'directional',
    }
  }).sort((a, b) => b.scoreLift - a.scoreLift || b.count - a.count).slice(0, 8)

  const fatigued = creatives.filter(item => item.fatigued)
  const untagged = creatives.filter(item => item.fingerprintCompleteness < 35)
  const leader = creatives.find(item => item.impressions >= 500) ?? creatives[0] ?? null
  const recommendations: Array<{ type: string; priority: 'high' | 'medium' | 'low'; title: string; detail: string; creativeKey?: string }> = []
  for (const creative of fatigued.slice(0, 3)) recommendations.push({
    type: 'fatigue', priority: 'high', creativeKey: creative.key,
    title: `Refresh ${creative.name}`,
    detail: `${creative.fatigueReasons.join(' and ')}. Keep the winning message and test a new opening or visual treatment.`,
  })
  if (leader) recommendations.push({
    type: 'scale', priority: 'medium', creativeKey: leader.key,
    title: `Build the next test from ${leader.name}`,
    detail: `It leads this selection with a ${leader.score}/100 creative score. Preserve its strongest element and vary one controlled factor.`,
  })
  if (untagged.length) recommendations.push({
    type: 'metadata', priority: 'low',
    title: `Fingerprint ${untagged.length} creative${untagged.length === 1 ? '' : 's'}`,
    detail: 'Add hook, offer, CTA, angle, and visual style so future recommendations explain why performance changed.',
  })

  return {
    benchmark,
    creatives,
    patterns,
    recommendations,
    summary: {
      totalCreatives: creatives.length,
      activeCreatives: creatives.filter(item => item.lifecycleStatus === 'active').length,
      fatiguedCreatives: fatigued.length,
      fingerprintedCreatives: creatives.filter(item => item.fingerprintCompleteness >= 35).length,
      leader,
      averageScore: Math.round(averageScore),
      confidence: benchmark.impressions >= 15000 && creatives.length >= 3 ? 'high' : benchmark.impressions >= 3000 ? 'medium' : 'early signal',
    },
  }
}

export type CreativeIntelligenceQuery = {
  clientId: string
  projectId?: string | null
  provider?: string | null
  campaign?: string | null
  start: string
  end: string
}

export async function loadCreativeIntelligence(db: SupabaseClient, options: CreativeIntelligenceQuery) {
  const startDate = new Date(`${options.start}T00:00:00Z`)
  const endDate = new Date(`${options.end}T00:00:00Z`)
  const duration = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1
  const previousEnd = new Date(startDate); previousEnd.setUTCDate(previousEnd.getUTCDate() - 1)
  const previousStart = new Date(previousEnd); previousStart.setUTCDate(previousStart.getUTCDate() - duration + 1)
  let currentQuery = db.from('campaign_ad_metrics_daily').select('*').eq('client_id', options.clientId).gte('metric_date', options.start).lte('metric_date', options.end)
  let previousQuery = db.from('campaign_ad_metrics_daily').select('*').eq('client_id', options.clientId)
    .gte('metric_date', previousStart.toISOString().slice(0, 10)).lte('metric_date', previousEnd.toISOString().slice(0, 10))
  let profilesQuery = db.from('creative_profiles').select('*').eq('client_id', options.clientId)
  if (options.projectId) {
    currentQuery = currentQuery.eq('project_id', options.projectId)
    previousQuery = previousQuery.eq('project_id', options.projectId)
    profilesQuery = profilesQuery.or(`project_id.eq.${options.projectId},project_id.is.null`)
  }
  if (options.provider) {
    currentQuery = currentQuery.eq('provider', options.provider)
    previousQuery = previousQuery.eq('provider', options.provider)
    profilesQuery = profilesQuery.eq('provider', options.provider)
  }
  if (options.campaign) {
    currentQuery = currentQuery.eq('external_campaign_id', options.campaign)
    previousQuery = previousQuery.eq('external_campaign_id', options.campaign)
  }
  const [{ data: currentRows, error: currentError }, { data: previousRows }, { data: profiles, error: profileError }] = await Promise.all([currentQuery, previousQuery, profilesQuery])
  if (currentError) throw currentError
  return {
    ...buildCreativeIntelligence(currentRows ?? [], previousRows ?? [], profileError ? [] : profiles ?? []),
    period: { start: options.start, end: options.end, previousStart: previousStart.toISOString().slice(0, 10), previousEnd: previousEnd.toISOString().slice(0, 10) },
    migrationReady: !profileError,
  }
}
