import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notify'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  let query = admin()
    .from('approvals')
    .select('*, requester_profile:profiles!approvals_requester_fkey(full_name, email)')
    .order('created_at', { ascending: false })

  // Members see only their own; managers/admins see all
  if (!['owner', 'admin', 'manager'].includes(me?.role ?? '')) {
    query = query.eq('requester', user.id)
  }
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const b = await req.json()
  if (!b.title || !b.type) return NextResponse.json({ error: 'Type and title are required' }, { status: 400 })

  const db = admin()
  const { data, error } = await db.from('approvals').insert({
    requester: user.id,
    type: b.type,
    title: b.title,
    details: b.details || null,
    amount: b.amount ? Number(b.amount) : null,
    start_date: b.start_date || null,
    end_date: b.end_date || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify approvers
  const { data: approvers } = await db.from('profiles').select('id, full_name').in('role', ['owner', 'admin', 'manager'])
  const { data: mine } = await db.from('profiles').select('full_name').eq('id', user.id).single()
  if (approvers?.length) {
    await notifyUsers(db, {
      userIds: approvers.filter(a => a.id !== user.id).map(a => a.id),
      title: `Approval needed: ${b.title}`,
      body: `${mine?.full_name ?? 'A team member'} submitted a ${b.type.replace('_', ' ')} request`,
      href: '/approvals',
      category: 'approval_request',
    })
  }
  return NextResponse.json(data)
}
