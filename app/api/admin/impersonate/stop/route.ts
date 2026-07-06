import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { logActivity } from '@/lib/activityLog'

const IMPERSONATOR_COOKIE = 'mm_impersonator'

export async function POST() {
  const raw = cookies().get(IMPERSONATOR_COOKIE)?.value
  if (!raw) return NextResponse.json({ error: 'Not currently viewing as another user' }, { status: 400 })

  let stashed: { access_token: string; refresh_token: string; admin_id: string; admin_email: string; target_email: string }
  try {
    stashed = JSON.parse(raw)
  } catch {
    cookies().delete(IMPERSONATOR_COOKIE)
    return NextResponse.json({ error: 'Corrupt session data — cleared, please sign in again' }, { status: 400 })
  }

  const supabase = createClient()
  const { data, error } = await supabase.auth.setSession({
    access_token: stashed.access_token,
    refresh_token: stashed.refresh_token,
  })
  cookies().delete(IMPERSONATOR_COOKIE)

  if (error || !data.user) {
    return NextResponse.json({ error: 'Could not restore your admin session — please sign in again' }, { status: 400 })
  }

  await logActivity(data.user, 'impersonate_stop', 'user', null, `returned from viewing as ${stashed.target_email}`)

  return NextResponse.json({ success: true })
}
