import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { isExpoToken } from '@/lib/push'

/** The Mesh Media phone app registers its Expo push token here (any signed-in
 *  role, clients included). Stored beside browser subscriptions. */
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const body = await req.json().catch(() => ({}))
  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!isExpoToken(token)) return NextResponse.json({ error: 'Invalid push token' }, { status: 400 })
  const platform = body.platform === 'android' ? 'android' : 'ios'

  const { error } = await serviceRole().from('browser_push_subscriptions').upsert({
    user_id: auth.user.id, endpoint: token, p256dh: 'expo', auth: platform,
    user_agent: `Mesh Media app (${platform})`, updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
}

/** Called on sign-out so a shared phone stops getting the last user's alerts. */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const token = req.nextUrl.searchParams.get('token') ?? ''
  if (!token) return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  const { error } = await serviceRole().from('browser_push_subscriptions').delete()
    .eq('user_id', auth.user.id).eq('endpoint', token)
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
}
