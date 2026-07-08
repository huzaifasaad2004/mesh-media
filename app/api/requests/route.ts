import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/roles'
import { notifyUsers } from '@/lib/notify'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const db = admin()

  let query = db
    .from('client_requests')
    .select('*, client:clients(id, company_name)')
    .order('created_at', { ascending: false })

  if (me?.role === 'client') {
    // Clients only see their own
    const { data: links } = await db.from('client_contacts').select('client_id').eq('user_id', user.id)
    const ids = (links ?? []).map(l => l.client_id)
    if (ids.length === 0) return NextResponse.json([])
    query = query.in('client_id', ids)
  } else if (!isAdmin(me?.role)) {
    // Non-admin staff only see requests for clients they actually work with
    // (assigned tasks or project membership) — not every request made to
    // the agency/owner.
    const [{ data: assignedTasks }, { data: memberProjects }] = await Promise.all([
      db.from('tasks').select('client_id').eq('assigned_to', user.id).not('client_id', 'is', null),
      db.from('project_members').select('project:projects(client_id)').eq('user_id', user.id),
    ])
    const ids = new Set<string>()
    for (const t of assignedTasks ?? []) if (t.client_id) ids.add(t.client_id)
    for (const p of memberProjects ?? []) {
      const clientId = (p as any).project?.client_id
      if (clientId) ids.add(clientId)
    }
    if (ids.size === 0) return NextResponse.json([])
    query = query.in('client_id', Array.from(ids))
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { subject, body, client_id } = await req.json()
  if (!subject) return NextResponse.json({ error: 'Subject is required' }, { status: 400 })

  const db = admin()
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  // Resolve which client this request belongs to
  let clientId = client_id
  if (me?.role === 'client') {
    const { data: link } = await db.from('client_contacts').select('client_id').eq('user_id', user.id).limit(1).maybeSingle()
    if (!link) return NextResponse.json({ error: 'No client linked to your account' }, { status: 400 })
    clientId = link.client_id
  }
  if (!clientId) return NextResponse.json({ error: 'Client is required' }, { status: 400 })

  const { data, error } = await db.from('client_requests')
    .insert({ client_id: clientId, created_by: user.id, subject, body: body ?? null })
    .select('*, client:clients(company_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify staff of new request
  const { data: staff } = await db.from('profiles').select('id').in('role', ['owner', 'admin', 'manager'])
  if (staff?.length) {
    await notifyUsers(db, {
      userIds: staff.map(s => s.id),
      title: `New request: ${subject}`,
      body: `From ${(data as any).client?.company_name ?? 'a client'}`,
      href: '/requests',
      category: 'critical_alert',
    })
  }

  return NextResponse.json(data)
}
