import { google } from 'googleapis'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/crypto'

/** Calendar (Mesh Media doesn't touch Gmail, unlike Celine which reuses the
 *  same GOOGLE_CLIENT_ID/SECRET for its own Calendar+Gmail scopes) plus a
 *  read-only email scope purely so Settings can show "Connected as x@y.com". */
export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email',
]

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function redirectUri() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.m3m.ae'
  return `${base}/api/google/oauth/callback`
}

// No explicit return-type annotation — inferred from the constructor, so
// downstream code can reference `OAuth2Client` below without a circular
// reference. This also sidesteps a TS structural mismatch: googleapis
// bundles its own nested copy of google-auth-library, which TS treats as
// distinct from the top-level package if you import `Auth.OAuth2Client` by
// name instead of inferring it from the actual value in use.
export function oauthClient() {
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri())
}

export type OAuth2Client = ReturnType<typeof oauthClient>

export function isGoogleOAuthClientConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.TOKEN_ENCRYPTION_KEY)
}

export function getAuthUrl() {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // force a refresh token even on a re-connect
    scope: GOOGLE_SCOPES,
  })
}

/** account/connectedBy are only set on a fresh connect (the OAuth callback);
 *  omitted on a token-rotation save so an in-flight refresh never clobbers
 *  who connected it. */
export async function saveGoogleTokens(tokens: object, meta?: { account: string; connectedBy: string }) {
  const row: Record<string, unknown> = {
    provider: 'google',
    ciphertext: encrypt(JSON.stringify(tokens)),
    updated_at: new Date().toISOString(),
  }
  if (meta) { row.account = meta.account; row.connected_by = meta.connectedBy }
  await admin().from('google_oauth_tokens').upsert(row, { onConflict: 'provider' })
}

export async function disconnectGoogle() {
  await admin().from('google_oauth_tokens').delete().eq('provider', 'google')
}

/** Called right after exchanging the OAuth code, while we still have a
 *  freshly-authenticated client — used only to label which account got
 *  connected in Settings, not for anything security-relevant. */
export async function fetchConnectedEmail(client: OAuth2Client): Promise<string | null> {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client })
    const { data } = await oauth2.userinfo.get()
    return data.email ?? null
  } catch {
    return null
  }
}

export async function getConnectedAccount(): Promise<string | null> {
  const { data } = await admin().from('google_oauth_tokens').select('account').eq('provider', 'google').maybeSingle()
  return data?.account ?? null
}

/** Authenticated client, or null when Google Calendar isn't connected yet. */
export async function getGoogleAuth(): Promise<OAuth2Client | null> {
  if (!isGoogleOAuthClientConfigured()) return null
  try {
    const { data } = await admin().from('google_oauth_tokens').select('ciphertext').eq('provider', 'google').maybeSingle()
    if (!data) return null
    const tokens = JSON.parse(decrypt(data.ciphertext))
    const client = oauthClient()
    client.setCredentials(tokens)
    // Google rotates the access token (and occasionally the refresh token)
    // on use — persist whatever comes back so the next call doesn't have
    // to re-authenticate from a stale token.
    client.on('tokens', (t) => {
      saveGoogleTokens({ ...tokens, ...(t as object) }).catch(() => {})
    })
    return client
  } catch {
    return null
  }
}
