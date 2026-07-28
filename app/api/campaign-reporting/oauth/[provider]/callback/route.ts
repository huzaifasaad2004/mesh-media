import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { serviceRole } from '@/lib/apiAuth'
import { encryptCampaignToken } from '@/lib/campaignReporting'

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const saved = cookies().get('campaign_oauth')?.value
  cookies().delete('campaign_oauth')
  if (!saved) return NextResponse.redirect(new URL('/campaign-reporting?error=oauth_expired', req.url))
  const flow = JSON.parse(saved) as { state: string; provider: string; connectionId: string }
  const code = req.nextUrl.searchParams.get('code'); const state = req.nextUrl.searchParams.get('state')
  if (!code || state !== flow.state || params.provider !== flow.provider) return NextResponse.redirect(new URL('/campaign-reporting?error=oauth_invalid', req.url))
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const redirectUri = `${baseUrl}/api/campaign-reporting/oauth/${params.provider}/callback`
  try {
    let accessToken = ''; let refreshToken: string | null = null; let expiresAt: string | null = null
    if (params.provider === 'google_ads') {
      const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_ADS_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET ?? '', redirect_uri: redirectUri, grant_type: 'authorization_code' }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error_description ?? 'Google OAuth failed')
      accessToken = data.access_token; refreshToken = data.refresh_token ?? null; expiresAt = new Date(Date.now() + Number(data.expires_in ?? 3600) * 1000).toISOString()
    } else {
      const version = process.env.META_GRAPH_VERSION ?? 'v23.0'
      const url = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
      url.search = new URLSearchParams({ client_id: process.env.META_APP_ID ?? '', client_secret: process.env.META_APP_SECRET ?? '', redirect_uri: redirectUri, code }).toString()
      const response = await fetch(url); const data = await response.json(); if (!response.ok) throw new Error(data.error?.message ?? 'Meta OAuth failed')
      accessToken = data.access_token
      const longLived = new URL(`https://graph.facebook.com/${version}/oauth/access_token`)
      longLived.search = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: process.env.META_APP_ID ?? '', client_secret: process.env.META_APP_SECRET ?? '', fb_exchange_token: accessToken }).toString()
      const longResponse = await fetch(longLived); const longData = await longResponse.json()
      if (longResponse.ok && longData.access_token) { accessToken = longData.access_token; data.expires_in = longData.expires_in }
      expiresAt = data.expires_in ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString() : null
    }
    await serviceRole().from('campaign_connections').update({ access_token_ciphertext: encryptCampaignToken(accessToken), refresh_token_ciphertext: refreshToken ? encryptCampaignToken(refreshToken) : null, token_expires_at: expiresAt, status: 'active', last_error: null }).eq('id', flow.connectionId)
    return NextResponse.redirect(new URL('/campaign-reporting?connected=1', req.url))
  } catch (error) {
    await serviceRole().from('campaign_connections').update({ status: 'error', last_error: error instanceof Error ? error.message : 'OAuth failed' }).eq('id', flow.connectionId)
    return NextResponse.redirect(new URL('/campaign-reporting?error=oauth_failed', req.url))
  }
}
