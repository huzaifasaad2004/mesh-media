import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2])
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthPage = request.nextUrl.pathname.startsWith('/login')
  const isSetPassword = request.nextUrl.pathname === '/set-password'
  const isPublicPath = request.nextUrl.pathname === '/'
    || request.nextUrl.pathname.startsWith('/auth/')
    // Celine's action API authenticates its own requests via CELINE_API_TOKEN
    // bearer token (see lib/celine/auth.ts) — it has no browser session to check.
    || request.nextUrl.pathname.startsWith('/api/celine/')
    // Clients open these print pages from an emailed link with no session at
    // all. The underlying API routes already gate writes with their own
    // requireRoles()/requireFinanceRead() checks (401/403 JSON) — the
    // middleware only needs to stop redirecting reads to an HTML /login page.
    || request.nextUrl.pathname.startsWith('/invoice/')
    || request.nextUrl.pathname.startsWith('/quotation/')
    || request.nextUrl.pathname.startsWith('/api/invoices')
    || request.nextUrl.pathname.startsWith('/api/quotations')
    // Document recipients with no account sign via a personal ?token= link
    // (see app/api/documents/[id]/public/route.ts, which verifies the token
    // itself); the page and its field-fill API self-enforce the token check.
    || request.nextUrl.pathname.startsWith('/documents/')
    || request.nextUrl.pathname.startsWith('/api/documents/')
    // Contractors (project-based freelancers, most without accounts) get the
    // same personal ?token= link pattern, plus a public receipt print page —
    // both self-enforce the token check server-side.
    || request.nextUrl.pathname.startsWith('/contractors/')
    || request.nextUrl.pathname.startsWith('/api/contractors/')
    || request.nextUrl.pathname.startsWith('/receipt/')
    || request.nextUrl.pathname.startsWith('/api/receipt/')
    // Stripe's servers call this with no browser session — verified by
    // webhook signature instead (see app/api/webhooks/stripe/route.ts).
    || request.nextUrl.pathname.startsWith('/api/webhooks/')
    // Vercel Cron calls these with no browser session — verified by
    // CRON_SECRET bearer token instead (see lib/cron.ts).
    || request.nextUrl.pathname.startsWith('/api/cron/')

  if (!user && !isAuthPage && !isPublicPath && !isSetPassword) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Invited teammates must choose a password before touching anything else.
  // This depends on a migration (profiles.password_set) — never let a
  // missing column/table or any other hiccup here take down the whole app;
  // worst case we just skip the redirect for this request.
  if (user && !isSetPassword && !isPublicPath && !request.nextUrl.pathname.startsWith('/api')) {
    try {
      const { data: profile } = await supabase.from('profiles').select('password_set').eq('id', user.id).single()
      if (profile && profile.password_set === false) {
        const url = request.nextUrl.clone()
        url.pathname = '/set-password'
        return NextResponse.redirect(url)
      }
    } catch { /* schema not migrated yet or transient error — fail open */ }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
