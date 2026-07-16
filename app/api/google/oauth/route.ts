import { NextResponse } from 'next/server'
import { requireRoles, MANAGERS } from '@/lib/apiAuth'
import { isGoogleOAuthClientConfigured, getAuthUrl, disconnectGoogle, getConnectedAccount } from '@/lib/google/oauth'

const CONNECT_ROLES: typeof MANAGERS = ['owner', 'admin']

// Status for the Settings page: is the OAuth client configured (env vars),
// and if so, is an account actually connected (and which one).
export async function GET() {
  const auth = await requireRoles(CONNECT_ROLES)
  if ('res' in auth) return auth.res
  const configured = isGoogleOAuthClientConfigured()
  const account = configured ? await getConnectedAccount() : null
  return NextResponse.json({ configured, connected: !!account, account })
}

// Kicks off the OAuth flow — redirects the browser straight to Google's
// consent screen (this is a top-level navigation, not fetch, so a redirect
// response is exactly right).
export async function POST() {
  const auth = await requireRoles(CONNECT_ROLES)
  if ('res' in auth) return auth.res
  if (!isGoogleOAuthClientConfigured()) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/TOKEN_ENCRYPTION_KEY are not set — see SETUP.md Step 7' }, { status: 400 })
  }
  return NextResponse.json({ url: getAuthUrl() })
}

export async function DELETE() {
  const auth = await requireRoles(CONNECT_ROLES)
  if ('res' in auth) return auth.res
  await disconnectGoogle()
  return NextResponse.json({ success: true })
}
