import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function getUser() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const since = req.nextUrl.searchParams.get('since') // YYYY-MM-DD
  let query = admin()
    .from('time_entries')
    .select('*, task:tasks(title), project:projects(name), client:clients(company_name)')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (since) query = query.gte('entry_date', since)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const b = await req.json()
  const { data, error } = await admin().from('time_entries').insert({
    user_id: user.id,
    task_id: b.task_id || null,
    project_id: b.project_id || null,
    client_id: b.client_id || null,
    description: b.description || null,
    minutes: Math.max(0, Math.round(Number(b.minutes) || 0)),
    billable: b.billable ?? true,
    entry_date: b.entry_date || new Date().toISOString().split('T')[0],
    ended_at: new Date().toISOString(),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
