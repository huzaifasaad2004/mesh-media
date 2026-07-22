import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/apiAuth'
import type { NotifyCategory } from '@/lib/notify'

const CATEGORIES: NotifyCategory[] = ['task_assignment', 'approval_request', 'content_review', 'critical_alert', 'task_feedback', 'meeting', 'chat']

// Default-enabled: no row for a category means email is on.
export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data } = await auth.db.from('notification_preferences').select('category, email_enabled').eq('user_id', auth.user.id)
  const rows = new Map((data ?? []).map(p => [p.category, p.email_enabled]))
  return NextResponse.json(CATEGORIES.map(category => ({ category, email_enabled: rows.get(category) ?? true })))
}

// Body: { category, email_enabled }
export async function PUT(req: NextRequest) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { category, email_enabled } = await req.json()
  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  const { error } = await auth.db.from('notification_preferences')
    .upsert({ user_id: auth.user.id, category, email_enabled: !!email_enabled }, { onConflict: 'user_id,category' })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
