import { NextRequest, NextResponse } from 'next/server'
import { requireRoles } from '@/lib/apiAuth'
import { oauthClient, saveGoogleTokens, fetchConnectedEmail } from '@/lib/google/oauth'

// Google redirects the browser here after consent — this is a normal
// top-level navigation from inside an already-authenticated session, so the
// same role check as starting the flow applies.
export async function GET(req: NextRequest) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  const code = req.nextUrl.searchParams.get('code')
  const settingsUrl = new URL('/settings', req.nextUrl.origin)

  if (!code) {
    settingsUrl.searchParams.set('google', 'error')
    return NextResponse.redirect(settingsUrl)
  }

  try {
    const client = oauthClient()
    const { tokens } = await client.getToken(code)
    if (!tokens.refresh_token) {
      // Google only returns a refresh token on the FIRST consent (or after
      // prompt=consent, which getAuthUrl() always sets) — if this ever
      // fires it means the account needs to be removed from
      // myaccount.google.com/permissions and reconnected from scratch.
      settingsUrl.searchParams.set('google', 'no_refresh_token')
      return NextResponse.redirect(settingsUrl)
    }
    client.setCredentials(tokens)
    const email = await fetchConnectedEmail(client)
    await saveGoogleTokens(tokens, { account: email ?? 'unknown', connectedBy: auth.user.id })
    settingsUrl.searchParams.set('google', 'connected')
  } catch {
    settingsUrl.searchParams.set('google', 'error')
  }

  return NextResponse.redirect(settingsUrl)
}
