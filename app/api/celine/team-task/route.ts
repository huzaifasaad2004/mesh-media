// ── app/api/celine/team-task/route.ts (add to the m3m repo) ─────────
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { celineAuthorized } from '@/lib/celine/auth'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  if (!celineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { title, description, client_id, project_id, assigned_to, priority, due_date } = await req.json()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  const { data, error } = await admin().from('tasks').insert({
    title,
    description: description ? `${description}\n\n— created by Celine` : '— created by Celine',
    client_id: client_id ?? null,
    project_id: project_id ?? null,
    assigned_to: assigned_to ?? null,
    priority: ['low', 'medium', 'high', 'urgent'].includes(priority) ? priority : 'medium',
    due_date: due_date ?? null,
    status: 'todo',
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, task_id: data.id })
}
