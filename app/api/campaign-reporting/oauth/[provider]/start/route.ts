import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireRoles } from '@/lib/apiAuth'

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res
  const connectionId = req.nextUrl.searchParams.get('connection')
  if (!connectionId || !['meta_ads', 'instagram', 'google_ads'].includes(params.provider)) return NextResponse.json({ error: 'Invalid connection' }, { status: 400 })
  const state = crypto.randomBytes(24).toString('base64url')
  cookies().set('campaign_oauth', JSON.stringify({ state, provider: params.provider, connectionId }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const redirectUri = `${baseUrl}/api/campaign-reporting/oauth/${params.provider}/callback`
  if (params.provider === 'google_ads') {
    if (!process.env.GOOGLE_ADS_CLIENT_ID) return NextResponse.json({ error: 'Google Ads OAuth is not configured' }, { status: 503 })
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({ client_id: process.env.GOOGLE_ADS_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code', scope: 'https://www.googleapis.com/auth/adwords', access_type: 'offline', prompt: 'consent', state }).toString()
    return NextResponse.redirect(url)
  }
  if (!process.env.META_APP_ID) return NextResponse.json({ error: 'Meta OAuth is not configured' }, { status: 503 })
  const version = process.env.META_GRAPH_VERSION ?? 'v23.0'
  const scope = params.provider === 'meta_ads' ? 'ads_read,read_insights' : 'instagram_basic,instagram_manage_insights,pages_show_list'
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`)
  url.search = new URLSearchParams({ client_id: process.env.META_APP_ID, redirect_uri: redirectUri, response_type: 'code', scope, state }).toString()
  return NextResponse.redirect(url)
}
