import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireRoles, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

const IMPERSONATOR_COOKIE = 'mm_impersonator'

export async function POST(req: NextRequest) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  if (cookies().get(IMPERSONATOR_COOKIE)) {
    return NextResponse.json({ error: 'Already viewing as another user — return to admin first' }, { status: 400 })
  }

  const { targetUserId } = await req.json().catch(() => ({}))
  if (!targetUserId) return NextResponse.json({ error: 'targetUserId is required' }, { status: 400 })
  if (targetUserId === auth.user.id) return NextResponse.json({ error: "You can't view as yourself" }, { status: 400 })

  const db = serviceRole()
  const { data: target, error: targetError } = await db
    .from('profiles').select('id, email, full_name, role').eq('id', targetUserId).single()
  if (targetError || !target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Never allow impersonating an owner/admin — this feature is for seeing a
  // lower-privilege view, not for one admin to silently act as another.
  if (['owner', 'admin'].includes(target.role)) {
    return NextResponse.json({ error: 'Cannot view as another owner/admin' }, { status: 403 })
  }
  if (!target.email) return NextResponse.json({ error: 'That user has no email on file' }, { status: 400 })

  // Capture the current (real admin) session so we can restore it later.
  const { data: { session: adminSession } } = await auth.db.auth.getSession()
  if (!adminSession) return NextResponse.json({ error: 'Could not read current session' }, { status: 500 })

  const link = await db.auth.admin.generateLink({ type: 'magiclink', email: target.email })
  if (link.error || !link.data.properties?.hashed_token) {
    return NextResponse.json({ error: link.error?.message ?? 'Could not generate a session for that user' }, { status: 400 })
  }

  // Exchange the token server-side — this swaps the browser's auth cookies
  // to the target user's real session, so RLS scopes everything exactly as
  // they'd see it (including the client portal).
  const { error: verifyError } = await auth.db.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: 'magiclink',
  })
  if (verifyError) return NextResponse.json({ error: verifyError.message }, { status: 400 })

  cookies().set(IMPERSONATOR_COOKIE, JSON.stringify({
    access_token: adminSession.access_token,
    refresh_token: adminSession.refresh_token,
    admin_id: auth.user.id,
    admin_email: auth.user.email,
    target_email: target.email,
    target_role: target.role,
  }), {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 2, // 2 hours
  })

  await logActivity(auth.user, 'impersonate_start', 'user', target.id, `${target.full_name ?? target.email} (${target.role})`)

  return NextResponse.json({ success: true, redirect: target.role === 'client' ? '/portal' : '/dashboard' })
}
