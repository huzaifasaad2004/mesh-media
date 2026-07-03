import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { decision, reason } = await req.json()
  const status = decision === 'accept' ? 'accepted' : decision === 'decline' ? 'declined' : null
  if (!status) return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
  if (status === 'declined' && !reason?.trim()) {
    return NextResponse.json({ error: 'Please tell us why so we can follow up appropriately' }, { status: 400 })
  }

  const db = admin()

  // Ownership check: this user must be a contact for the quotation's client
  const { data: quote } = await db
    .from('quotations')
    .select('id, quote_number, total, status, client_id, client:clients(company_name)')
    .eq('id', params.id)
    .single()
  if (!quote) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })

  const { data: link } = await db
    .from('client_contacts')
    .select('client_id')
    .eq('user_id', user.id)
    .eq('client_id', quote.client_id)
    .maybeSingle()
  if (!link) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  if (!['sent', 'draft'].includes(quote.status)) {
    return NextResponse.json({ error: `This quotation is already ${quote.status}` }, { status: 400 })
  }

  await db.from('quotations').update({
    status,
    decided_at: new Date().toISOString(),
    decline_reason: status === 'declined' ? reason.trim() : null,
  }).eq('id', params.id)

  // Notify admins/managers in-app
  const { data: staff } = await db.from('profiles').select('id').in('role', ['owner', 'admin', 'manager'])
  if (staff?.length) {
    const company = (quote as any).client?.company_name ?? 'A client'
    const body = status === 'declined'
      ? `${company} declined · AED ${Number(quote.total).toLocaleString()} · Reason: ${reason.trim()}`
      : `${company} accepted the quotation · AED ${Number(quote.total).toLocaleString()}`
    await db.from('notifications').insert(staff.map(s => ({
      user_id: s.id,
      title: `Quotation ${quote.quote_number} ${status}`,
      body,
      href: '/finance/quotations',
    })))
  }

  return NextResponse.json({ success: true, status })
}
