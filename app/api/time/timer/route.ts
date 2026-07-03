import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Current running timer (if any)
export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data } = await admin()
    .from('time_entries')
    .select('*, task:tasks(title), project:projects(name), client:clients(company_name)')
    .eq('user_id', user.id)
    .not('started_at', 'is', null)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return NextResponse.json(data ?? null)
}

// Start a timer (stops any already-running one first)
export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const b = await req.json()
  const db = admin()

  // Stop any running timer
  const { data: running } = await db.from('time_entries')
    .select('id, started_at').eq('user_id', user.id).not('started_at', 'is', null).is('ended_at', null)
  for (const r of running ?? []) {
    const mins = Math.max(1, Math.round((Date.now() - new Date(r.started_at).getTime()) / 60000))
    await db.from('time_entries').update({ ended_at: new Date().toISOString(), minutes: mins }).eq('id', r.id)
  }

  const { data, error } = await db.from('time_entries').insert({
    user_id: user.id,
    task_id: b.task_id || null,
    project_id: b.project_id || null,
    client_id: b.client_id || null,
    description: b.description || null,
    billable: b.billable ?? true,
    started_at: new Date().toISOString(),
    minutes: 0,
  }).select('*, task:tasks(title), project:projects(name), client:clients(company_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Stop the running timer
export async function PATCH() {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const db = admin()
  const { data: running } = await db.from('time_entries')
    .select('id, started_at').eq('user_id', user.id).not('started_at', 'is', null).is('ended_at', null)
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  if (!running) return NextResponse.json({ error: 'No running timer' }, { status: 400 })
  const mins = Math.max(1, Math.round((Date.now() - new Date(running.started_at).getTime()) / 60000))
  const { data, error } = await db.from('time_entries')
    .update({ ended_at: new Date().toISOString(), minutes: mins }).eq('id', running.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
