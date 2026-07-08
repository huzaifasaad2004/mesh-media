import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { notifyUsers } from '@/lib/notify'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Body: { decision: 'approve' | 'decline', comment?: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { decision, comment } = await req.json()
  const status = decision === 'approve' ? 'client_approved' : decision === 'decline' ? 'client_declined' : null
  if (!status) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  if (status === 'client_declined' && !comment?.trim()) {
    return NextResponse.json({ error: 'Please add a comment so the team knows what to change' }, { status: 400 })
  }

  const db = admin()

  const { data: item } = await db.from('content_items')
    .select('id, title, status, client_id, created_by, manager_id, client:clients(company_name)')
    .eq('id', params.id).single()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Ownership check: this user must be a contact for the item's client.
  const { data: link } = await db.from('client_contacts')
    .select('client_id').eq('user_id', user.id).eq('client_id', item.client_id).maybeSingle()
  if (!link) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  if (item.status !== 'pending_client') {
    return NextResponse.json({ error: `This item is already ${item.status.replace('_', ' ')}` }, { status: 400 })
  }

  const { error } = await db.from('content_items').update({
    status,
    client_comment: comment?.trim() || null,
    client_decided_at: new Date().toISOString(),
  }).eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Notify the team (creator + reviewing manager) of the client's decision.
  const recipients = Array.from(new Set([item.created_by, item.manager_id].filter(Boolean))) as string[]
  if (recipients.length) {
    const company = (item as any).client?.company_name ?? 'A client'
    const body = status === 'client_approved'
      ? `${company} approved "${item.title}"`
      : `${company} declined "${item.title}"${comment ? ` — ${comment.trim()}` : ''}`
    await notifyUsers(db, {
      userIds: recipients,
      title: `Content ${status === 'client_approved' ? 'approved' : 'declined'} by client`,
      body,
      href: '/content',
      category: 'content_review',
    })
  }

  return NextResponse.json({ success: true, status })
}
