import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  return NextResponse.json({ enabled: !!publicKey, publicKey: publicKey ?? null })
}

export async function POST(req: NextRequest) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const body = await req.json()
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : ''
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh : ''
  const keyAuth = typeof body.keys?.auth === 'string' ? body.keys.auth : ''
  if (!endpoint || !p256dh || !keyAuth) return NextResponse.json({ error: 'Invalid push subscription' }, { status: 400 })

  const { error } = await serviceRole().from('browser_push_subscriptions').upsert({
    user_id: auth.user.id, endpoint, p256dh, auth: keyAuth,
    user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' })
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const endpoint = req.nextUrl.searchParams.get('endpoint')
  if (!endpoint) return NextResponse.json({ error: 'Endpoint is required' }, { status: 400 })
  const { error } = await serviceRole().from('browser_push_subscriptions').delete()
    .eq('user_id', auth.user.id).eq('endpoint', endpoint)
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ ok: true })
}
