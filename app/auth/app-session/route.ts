import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { serviceRole } from '@/lib/apiAuth'

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> }

/**
 * Lets the Mesh Media phone app open any website page inside the app already
 * signed in. The app's in-app browser POSTs its access token here; we check
 * it, then start a *separate* browser session for the same person (so the web
 * page and the app never fight over one refresh token) and redirect to `next`.
 */
export async function POST(req: NextRequest) {
  const origin = req.nextUrl.origin
  const toLogin = () => NextResponse.redirect(new URL('/login', origin), { status: 303 })
  const form = await req.formData().catch(() => null)
  const accessToken = String(form?.get('access_token') ?? '')
  const nextRaw = String(form?.get('next') ?? '/dashboard')
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard'
  if (!accessToken) return toLogin()

  const admin = serviceRole()
  const { data: who } = await admin.auth.getUser(accessToken)
  const email = who.user?.email
  if (!email) return toLogin()
  const { data: profile } = await admin.from('profiles').select('archived_at').eq('id', who.user!.id).single()
  if (profile?.archived_at) return toLogin()

  // One-time sign-in code for this person (nothing is emailed).
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link?.properties?.hashed_token
  if (linkError || !tokenHash) return toLogin()

  const res = NextResponse.redirect(new URL(next, origin), { status: 303 })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookies: CookieToSet[]) => cookies.forEach(({ name, value, options }) => res.cookies.set(name, value, options)),
    },
  })
  const { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
  return error ? toLogin() : res
}
