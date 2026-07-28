import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type CampaignProvider = 'meta_ads' | 'instagram' | 'google_ads'
export type CampaignConnection = {
  id: string; client_id: string; project_id: string | null; provider: CampaignProvider
  external_account_id: string; account_name: string | null; access_token_ciphertext: string | null
  refresh_token_ciphertext: string | null; settings: Record<string, string>; status: string
}
export type CampaignMetric = {
  external_campaign_id: string; campaign_name: string; metric_date: string; currency?: string
  impressions?: number; reach?: number; clicks?: number; engagements?: number; video_views?: number
  leads?: number; conversions?: number; spend?: number; revenue?: number; raw?: unknown
}

function encryptionKey() {
  // A dedicated key is preferred. The already-secret server service-role key
  // provides a secure production fallback so reporting can be enabled without
  // ever exposing or hardcoding credentials.
  const secret = process.env.CAMPAIGN_REPORTING_ENCRYPTION_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error('Campaign reporting encryption is not configured')
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptCampaignToken(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptCampaignToken(value: string) {
  const [iv, tag, encrypted] = value.split('.')
  if (!iv || !tag || !encrypted) throw new Error('Invalid encrypted campaign token')
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}

const num = (value: unknown) => Number(value ?? 0) || 0
const actionValue = (actions: any[] | undefined, names: string[]) => num(actions?.find(a => names.includes(a.action_type))?.value)

function googleAdsError(payload: any, status: number) {
  const envelope = Array.isArray(payload) ? payload.find(item => item?.error)?.error : payload?.error
  const failure = envelope?.details?.flatMap((detail: any) => detail?.errors ?? detail?.error?.errors ?? [])?.[0]
  return failure?.message ?? envelope?.message ?? `Google Ads reporting request failed (HTTP ${status})`
}

async function metaMetrics(connection: CampaignConnection, since: string, until: string): Promise<CampaignMetric[]> {
  const token = decryptCampaignToken(connection.access_token_ciphertext!)
  const version = process.env.META_GRAPH_VERSION ?? 'v23.0'
  const account = connection.external_account_id.replace(/^act_/, '')
  const fields = 'campaign_id,campaign_name,date_start,impressions,reach,clicks,spend,cpc,cpm,ctr,actions,action_values'
  let url = `https://graph.facebook.com/${version}/act_${encodeURIComponent(account)}/insights?level=campaign&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&fields=${fields}&limit=500&access_token=${encodeURIComponent(token)}`
  const rows: any[] = []
  while (url) {
    const response = await fetch(url)
    const payload = await response.json()
    if (!response.ok) throw new Error(payload.error?.message ?? 'Meta reporting request failed')
    rows.push(...(payload.data ?? [])); url = payload.paging?.next ?? ''
  }
  return rows.map(row => ({
    external_campaign_id: row.campaign_id, campaign_name: row.campaign_name, metric_date: row.date_start,
    impressions: num(row.impressions), reach: num(row.reach), clicks: num(row.clicks), spend: num(row.spend),
    engagements: actionValue(row.actions, ['post_engagement', 'page_engagement']),
    leads: actionValue(row.actions, ['lead', 'onsite_conversion.lead_grouped']),
    conversions: actionValue(row.actions, ['purchase', 'offsite_conversion.fb_pixel_purchase']),
    revenue: actionValue(row.action_values, ['purchase', 'offsite_conversion.fb_pixel_purchase']), raw: row,
  }))
}

async function metaAdMetrics(connection: CampaignConnection, since: string, until: string) {
  const token = decryptCampaignToken(connection.access_token_ciphertext!)
  const version = process.env.META_GRAPH_VERSION ?? 'v23.0'
  const account = connection.external_account_id.replace(/^act_/, '')
  const fields = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,date_start,impressions,reach,clicks,spend,actions,action_values'
  let url = `https://graph.facebook.com/${version}/act_${encodeURIComponent(account)}/insights?level=ad&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}&fields=${fields}&limit=500&access_token=${encodeURIComponent(token)}`
  const rows: any[] = []
  while (url) { const response = await fetch(url); const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Meta ad detail request failed'); rows.push(...(payload.data ?? [])); url = payload.paging?.next ?? '' }
  return rows.map(row => ({
    connection_id: connection.id, client_id: connection.client_id, project_id: connection.project_id, provider: connection.provider,
    external_campaign_id: row.campaign_id, campaign_name: row.campaign_name, external_ad_group_id: row.adset_id,
    ad_group_name: row.adset_name, external_ad_id: row.ad_id, ad_name: row.ad_name, ad_type: 'META_AD', ad_status: null,
    metric_date: row.date_start, currency: 'AED', impressions: num(row.impressions), clicks: num(row.clicks),
    engagements: actionValue(row.actions, ['post_engagement','page_engagement']), video_views: actionValue(row.actions, ['video_view']),
    conversions: actionValue(row.actions, ['purchase','offsite_conversion.fb_pixel_purchase','lead','onsite_conversion.lead_grouped']),
    spend: num(row.spend), revenue: actionValue(row.action_values, ['purchase','offsite_conversion.fb_pixel_purchase']),
    creative: { adName: row.ad_name }, raw: row, synced_at: new Date().toISOString(),
  }))
}

async function instagramMetrics(connection: CampaignConnection, since: string, until: string): Promise<CampaignMetric[]> {
  const token = decryptCampaignToken(connection.access_token_ciphertext!)
  const version = process.env.META_GRAPH_VERSION ?? 'v23.0'
  const metrics = 'reach,views,accounts_engaged,total_interactions,likes,comments,saves,shares,follows_and_unfollows'
  const url = `https://graph.facebook.com/${version}/${encodeURIComponent(connection.external_account_id)}/insights?metric=${metrics}&period=day&since=${since}&until=${until}&access_token=${encodeURIComponent(token)}`
  const response = await fetch(url)
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error?.message ?? 'Instagram reporting request failed')
  const byDate = new Map<string, Record<string, number>>()
  for (const metric of payload.data ?? []) for (const point of metric.values ?? []) {
    const date = String(point.end_time).slice(0, 10)
    byDate.set(date, { ...(byDate.get(date) ?? {}), [metric.name]: num(typeof point.value === 'object' ? Object.values(point.value).reduce((a: number, b) => a + num(b), 0) : point.value) })
  }
  return Array.from(byDate, ([date, values]) => ({
    external_campaign_id: connection.external_account_id, campaign_name: connection.account_name ?? 'Instagram Organic', metric_date: date,
    impressions: values.views, reach: values.reach, engagements: values.total_interactions || values.accounts_engaged,
    clicks: 0, video_views: values.views, raw: values,
  })).filter(row => row.metric_date >= since && row.metric_date <= until)
}

async function googleAccessToken(connection: CampaignConnection) {
  if (!connection.refresh_token_ciphertext) return decryptCampaignToken(connection.access_token_ciphertext!)
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '',
    refresh_token: decryptCampaignToken(connection.refresh_token_ciphertext), grant_type: 'refresh_token',
  }) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error_description ?? 'Google token refresh failed')
  return payload.access_token as string
}

async function googleMetrics(connection: CampaignConnection, since: string, until: string): Promise<CampaignMetric[]> {
  const token = await googleAccessToken(connection)
  const customer = connection.external_account_id.replace(/-/g, '')
  const query = `SELECT campaign.id, campaign.name, segments.date, customer.currency_code, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.engagements, metrics.video_trueview_views FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '', 'Content-Type': 'application/json' }
  if (connection.settings?.login_customer_id) headers['login-customer-id'] = connection.settings.login_customer_id.replace(/-/g, '')
  const apiVersion = process.env.GOOGLE_ADS_API_VERSION ?? 'v23'
  const response = await fetch(`https://googleads.googleapis.com/${apiVersion}/customers/${customer}/googleAds:searchStream`, { method: 'POST', headers, body: JSON.stringify({ query }) })
  const payload = await response.json()
  if (!response.ok) throw new Error(googleAdsError(payload, response.status))
  return (payload as any[]).flatMap(batch => batch.results ?? []).map(row => ({
    external_campaign_id: String(row.campaign.id), campaign_name: row.campaign.name, metric_date: row.segments.date,
    currency: row.customer.currencyCode, impressions: num(row.metrics.impressions), clicks: num(row.metrics.clicks),
    engagements: num(row.metrics.engagements), video_views: num(row.metrics.videoTrueviewViews),
    conversions: num(row.metrics.conversions), spend: num(row.metrics.costMicros) / 1_000_000,
    revenue: num(row.metrics.conversionsValue), raw: row,
  }))
}

async function googleAdMetrics(connection: CampaignConnection, since: string, until: string) {
  const token = await googleAccessToken(connection)
  const customer = connection.external_account_id.replace(/-/g, '')
  const query = `SELECT campaign.id, campaign.name, ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.ad.final_urls, ad_group_ad.status, segments.date, customer.currency_code, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, metrics.engagements, metrics.video_trueview_views FROM ad_group_ad WHERE segments.date BETWEEN '${since}' AND '${until}'`
  const headers: Record<string, string> = { Authorization: `Bearer ${token}`, 'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN ?? '', 'Content-Type': 'application/json' }
  if (connection.settings?.login_customer_id) headers['login-customer-id'] = connection.settings.login_customer_id.replace(/-/g, '')
  const version = process.env.GOOGLE_ADS_API_VERSION ?? 'v23'
  const response = await fetch(`https://googleads.googleapis.com/${version}/customers/${customer}/googleAds:searchStream`, { method: 'POST', headers, body: JSON.stringify({ query }) })
  const payload = await response.json()
  if (!response.ok) throw new Error(googleAdsError(payload, response.status))
  return (payload as any[]).flatMap(batch => batch.results ?? []).map((row: any) => ({
    connection_id: connection.id, client_id: connection.client_id, project_id: connection.project_id, provider: connection.provider,
    external_campaign_id: String(row.campaign.id), campaign_name: row.campaign.name,
    external_ad_group_id: String(row.adGroup.id), ad_group_name: row.adGroup.name,
    external_ad_id: String(row.adGroupAd.ad.id), ad_name: row.adGroupAd.ad.name || `Ad ${row.adGroupAd.ad.id}`,
    ad_type: row.adGroupAd.ad.type, ad_status: row.adGroupAd.status, metric_date: row.segments.date,
    currency: row.customer.currencyCode, impressions: num(row.metrics.impressions), clicks: num(row.metrics.clicks),
    engagements: num(row.metrics.engagements), video_views: num(row.metrics.videoTrueviewViews), conversions: num(row.metrics.conversions),
    spend: num(row.metrics.costMicros) / 1_000_000, revenue: num(row.metrics.conversionsValue),
    creative: { finalUrls: row.adGroupAd.ad.finalUrls ?? [] }, raw: row, synced_at: new Date().toISOString(),
  }))
}

export async function syncCampaignConnection(db: SupabaseClient, connection: CampaignConnection, since: string, until: string) {
  if (!connection.access_token_ciphertext) throw new Error('Connection has not been authorised')
  const metrics = connection.provider === 'meta_ads' ? await metaMetrics(connection, since, until)
    : connection.provider === 'instagram' ? await instagramMetrics(connection, since, until)
      : await googleMetrics(connection, since, until)
  if (metrics.length) {
    const { error } = await db.from('campaign_metrics_daily').upsert(metrics.map(metric => ({
      connection_id: connection.id, client_id: connection.client_id, project_id: connection.project_id,
      provider: connection.provider, external_campaign_id: metric.external_campaign_id, campaign_name: metric.campaign_name,
      metric_date: metric.metric_date, currency: metric.currency ?? 'AED', impressions: metric.impressions ?? 0,
      reach: metric.reach ?? 0, clicks: metric.clicks ?? 0, engagements: metric.engagements ?? 0,
      video_views: metric.video_views ?? 0, leads: metric.leads ?? 0, conversions: metric.conversions ?? 0,
      spend: metric.spend ?? 0, revenue: metric.revenue ?? 0, raw: metric.raw ?? {}, synced_at: new Date().toISOString(),
    })), { onConflict: 'connection_id,external_campaign_id,metric_date' })
    if (error) throw error
  }
  if (connection.provider === 'google_ads' || connection.provider === 'meta_ads') {
    try {
      const ads: any[] = connection.provider === 'google_ads' ? await googleAdMetrics(connection, since, until) : await metaAdMetrics(connection, since, until)
      if (ads.length) {
        const { error } = await db.from('campaign_ad_metrics_daily').upsert(ads, { onConflict: 'connection_id,external_ad_id,metric_date' })
        if (error) throw error
      }
    } catch (error) {
      // Main campaign totals remain usable if an account has an ad format that
      // Google does not expose through the detail resource.
      console.warn('Campaign creative detail sync skipped:', error instanceof Error ? error.message : error)
    }
  }
  await db.from('campaign_connections').update({ status: 'active', last_synced_at: new Date().toISOString(), last_error: null }).eq('id', connection.id)
  return metrics.length
}

export async function campaignTotals(db: SupabaseClient, clientId: string, start: string, end: string, projectId?: string | null) {
  let query = db.from('campaign_metrics_daily').select('provider, impressions, reach, clicks, engagements, video_views, leads, conversions, spend, revenue')
    .eq('client_id', clientId).gte('metric_date', start).lte('metric_date', end)
  if (projectId) query = query.eq('project_id', projectId)
  const { data } = await query
  const rows = data ?? []
  return rows.reduce((total: any, row: any) => ({
    impressions: total.impressions + num(row.impressions), reach: total.reach + num(row.reach), clicks: total.clicks + num(row.clicks),
    engagements: total.engagements + num(row.engagements), videoViews: total.videoViews + num(row.video_views),
    leads: total.leads + num(row.leads), conversions: total.conversions + num(row.conversions), spend: total.spend + num(row.spend), revenue: total.revenue + num(row.revenue),
  }), { impressions: 0, reach: 0, clicks: 0, engagements: 0, videoViews: 0, leads: 0, conversions: 0, spend: 0, revenue: 0 })
}
