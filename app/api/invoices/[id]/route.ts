import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { requireRoles, FINANCE_WRITE, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { emitCelineEvent } from '@/lib/celine/events'
import { computeTotals } from '@/lib/documentTotals'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Intentionally public — clients open this via the emailed invoice link without a session.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await admin()
    .from('invoices')
    .select('*, client:clients(company_name, email, contact_person, phone, address), items:invoice_items(*)')
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Tell Celine when an actual client (not staff) opens their invoice —
  // she uses repeat views of overdue invoices as a payment-psychology signal.
  notifyCelineIfClientView(params.id, data).catch(() => {})

  return NextResponse.json(data)
}

async function notifyCelineIfClientView(invoiceId: string, invoice: any) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'client') return
  await emitCelineEvent('invoice_viewed', 'client', {
    invoice_id: invoiceId,
    invoice_number: invoice.invoice_number,
    client_name: invoice.client?.company_name,
    status: invoice.status,
    amount: invoice.total,
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(FINANCE_WRITE, 'finance.write')
  if ('res' in auth) return auth.res

  const body = await req.json()
  const { items, ...invoiceData } = body

  // Revenue reporting is keyed off paid_date, not status — stamp it the
  // moment an invoice is marked paid (unless already set / explicitly
  // provided), and clear it if the status is reverted away from paid.
  if (invoiceData.status === 'paid' && !invoiceData.paid_date) {
    const { data: existing } = await admin().from('invoices').select('paid_date').eq('id', params.id).single()
    if (!existing?.paid_date) invoiceData.paid_date = new Date().toISOString().split('T')[0]
  } else if (invoiceData.status && invoiceData.status !== 'paid') {
    invoiceData.paid_date = null
  }

  if (items) {
    const { subtotal, taxAmount, total } = computeTotals(items, invoiceData.discount_type, invoiceData.discount_value, invoiceData.tax_rate)
    await admin().from('invoice_items').delete().eq('invoice_id', params.id)
    await admin().from('invoice_items').insert(
      items.map((item: { description: string; quantity: number; unit_price: number }, idx: number) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        invoice_id: params.id,
        sort_order: idx,
      }))
    )
    invoiceData.subtotal = subtotal
    invoiceData.tax_amount = taxAmount
    invoiceData.total = total
  }

  const { data, error } = await admin().from('invoices').update(invoiceData).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'invoice', params.id, data.invoice_number)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const { data: existing } = await admin().from('invoices').select('invoice_number').eq('id', params.id).single()
  const { error } = await admin().from('invoices').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'invoice', params.id, existing?.invoice_number)
  return NextResponse.json({ success: true })
}
