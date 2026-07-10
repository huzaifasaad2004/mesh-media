import { NextRequest, NextResponse } from 'next/server'
import { requireContentApprove, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'
import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

// Body: { decision: 'forward' | 'reject', comment?: string }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireContentApprove()
  if ('res' in auth) return auth.res

  const { decision, comment } = await req.json()
  const status = decision === 'forward' ? 'pending_client' : decision === 'reject' ? 'manager_rejected' : null
  if (!status) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })

  const db = serviceRole()
  const { data: item } = await db.from('content_items')
    .select('id, title, status, created_by, client_id, client:clients(company_name, email, contact_person)')
    .eq('id', params.id).single()
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (item.status !== 'pending_manager') {
    return NextResponse.json({ error: `This item is already ${item.status.replace('_', ' ')}` }, { status: 400 })
  }

  const { data: updated, error } = await db.from('content_items').update({
    status,
    manager_id: auth.user.id,
    manager_comment: comment || null,
    manager_decided_at: new Date().toISOString(),
  }).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'update', 'content_item', params.id, `${item.title} → ${status}`)

  // Tell the creator either way — never the client on a rejection.
  if (item.created_by) {
    await notifyUsers(db, {
      userIds: [item.created_by],
      title: decision === 'forward' ? 'Content forwarded to client' : 'Content sent back for changes',
      body: `${item.title}${comment ? ` — ${comment}` : ''}`,
      href: '/content',
      category: 'content_review',
    })
  }

  // Forwarding to the client — email them, matching the quotation/document-request pattern.
  if (decision === 'forward' && process.env.RESEND_API_KEY && (item as any).client?.email) {
    const client = (item as any).client
    const resend = new Resend(process.env.RESEND_API_KEY)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    await resend.emails.send({
      from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
      to: client.email,
      subject: `Ready for your review: ${item.title}`,
      html: `<p>Dear ${client.contact_person ?? client.company_name},</p>
<p>New content is ready for your review: <strong>${item.title}</strong>.</p>
<p><a href="${baseUrl}/portal">Review in your portal →</a></p>
<p>${COMPANY.name}</p>`,
    }).catch(() => {})
  }

  return NextResponse.json(updated)
}
