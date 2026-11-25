import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { bearerToken } from '@/lib/supabase/bearer'

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** RLS-scoped Supabase client for the caller: the browser's session cookies,
 *  or — for the mobile app, which has none — its `Authorization: Bearer` token.
 *  Either way every query runs as that user under the same RLS policies. */
export function createClient() {
  const token = bearerToken(headers().get('authorization'))
  if (token) return createTokenClient(token)

  const cookieStore = cookies()

  return createServerClient(url(), anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          )
        } catch {}
      },
    },
  })
}

function createTokenClient(token: string) {
  const client = createServerClient(url(), anonKey(), {
    // No cookie session: the token is the whole identity, and nothing is written back.
    cookies: { getAll: () => [], setAll: () => {} },
    // Sent on every database/storage call, so RLS sees this user.
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  // Routes call `auth.getUser()` with no argument, which looks for a cookie
  // session. Point it at the token instead — Supabase still verifies it, so an
  // expired or forged token comes back as "no user" exactly like a bad cookie.
  const getUser = client.auth.getUser.bind(client.auth)
  client.auth.getUser = (jwt?: string) => getUser(jwt ?? token)

  return client
}
