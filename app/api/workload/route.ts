import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

function startOfWeek() {
  const d = new Date()
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return d.toISOString().split('T')[0]
}

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['owner', 'admin', 'manager'].includes(me.role)) {
    return NextResponse.json({ error: 'Managers only' }, { status: 403 })
  }

  const db = admin()
  const [{ data: staff }, { data: tasks }, { data: times }] = await Promise.all([
    db.from('profiles').select('id, full_name, email, role').neq('role', 'client').order('full_name'),
    db.from('tasks').select('assigned_to, status').neq('status', 'done'),
    db.from('time_entries').select('user_id, minutes').gte('entry_date', startOfWeek()).not('ended_at', 'is', null),
  ])

  const openByUser: Record<string, number> = {}
  for (const t of tasks ?? []) if (t.assigned_to) openByUser[t.assigned_to] = (openByUser[t.assigned_to] ?? 0) + 1
  const minsByUser: Record<string, number> = {}
  for (const e of times ?? []) minsByUser[e.user_id] = (minsByUser[e.user_id] ?? 0) + e.minutes

  const rows = (staff ?? []).map(s => ({
    id: s.id,
    full_name: s.full_name,
    email: s.email,
    role: s.role,
    open_tasks: openByUser[s.id] ?? 0,
    week_minutes: minsByUser[s.id] ?? 0,
  }))

  return NextResponse.json(rows)
}
