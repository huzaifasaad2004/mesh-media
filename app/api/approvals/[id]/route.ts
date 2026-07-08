import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notify'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['owner', 'admin', 'manager'].includes(me.role)) {
    return NextResponse.json({ error: 'Only managers can decide approvals' }, { status: 403 })
  }

  const { decision } = await req.json()
  const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : null
  if (!status) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })

  const db = admin()
  const { data, error } = await db.from('approvals')
    .update({ status, decided_by: user.id, decided_at: new Date().toISOString() })
    .eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify the requester of the decision
  await notifyUsers(db, {
    userIds: [data.requester],
    title: `Request ${status}: ${data.title}`,
    body: `Your ${data.type.replace('_', ' ')} request was ${status}.`,
    href: '/approvals',
    category: 'approval_request',
  })
  return NextResponse.json(data)
}
