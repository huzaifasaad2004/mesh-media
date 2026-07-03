import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { emitCelineEvent } from '@/lib/celine/events'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
  const body = await req.json()
  const { items, ...invoiceData } = body

  if (items) {
    const total = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
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
    invoiceData.subtotal = total
    invoiceData.total = total
  }

  const { data, error } = await admin().from('invoices').update(invoiceData).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await admin().from('invoices').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
