import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { notifyUsers } from '@/lib/notify'
import { logActivity } from '@/lib/activityLog'

/**
 * "Delete my account" from the phone app (App Store / Play Store require it
 * in-app). We don't hard-delete straight away — invoices, payments and
 * contracts must be kept for UAE records — so owners/admins get an urgent
 * notification to remove the login and personal data, and the person is
 * signed out on their device.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { reason } = await req.json().catch(() => ({ reason: null }))
  const db = serviceRole()
  const { data: me } = await db.from('profiles').select('full_name, email, role').eq('id', auth.user.id).single()
  const { data: admins } = await db.from('profiles').select('id').in('role', ['owner', 'admin']).is('archived_at', null)

  await notifyUsers(db, {
    userIds: (admins ?? []).map((a) => a.id),
    title: `Account deletion request: ${me?.full_name ?? me?.email ?? 'a user'}`,
    body: `${me?.email ?? ''} (${me?.role ?? 'user'}) asked to delete their account from the app.${typeof reason === 'string' && reason.trim() ? ` Reason: ${reason.trim().slice(0, 500)}` : ''} Remove their access within 30 days.`,
    href: me?.role === 'client' ? '/clients' : '/team',
    category: 'critical_alert',
  })
  await logActivity(auth.user, 'request_deletion', 'profile', auth.user.id, me?.email ?? '').catch(() => {})
  return NextResponse.json({ ok: true })
}
