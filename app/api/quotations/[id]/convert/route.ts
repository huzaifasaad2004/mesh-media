import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  // Staff only
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['owner', 'admin', 'manager'].includes(me.role)) {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const db = admin()
  const { data: quote, error } = await db
    .from('quotations')
    .select('*, items:quotation_items(*)')
    .eq('id', params.id)
    .single()
  if (error || !quote) return NextResponse.json({ error: 'Quotation not found' }, { status: 404 })
  if (quote.converted_invoice_id) {
    return NextResponse.json({ error: 'Already converted to an invoice' }, { status: 400 })
  }

  // Brand-consistent invoice number, continuing the MM-INV sequence
  const year = new Date().getFullYear()
  const { data: existing } = await db.from('invoices').select('invoice_number').ilike('invoice_number', `MM-INV-${year}-%`)
  let maxN = 100
  for (const row of existing ?? []) {
    const m = (row.invoice_number as string).match(/(\d+)$/)
    if (m) maxN = Math.max(maxN, parseInt(m[1], 10))
  }
  const invoice_number = `MM-INV-${year}-${String(maxN + 1).padStart(5, '0')}`

  const { data: invoice, error: invErr } = await db.from('invoices').insert({
    invoice_number,
    client_id: quote.client_id,
    project_id: quote.project_id ?? null,
    status: 'draft',
    issue_date: new Date().toISOString().split('T')[0],
    subject: quote.subject,
    subtotal: quote.subtotal,
    tax_rate: quote.tax_rate,
    tax_amount: quote.tax_amount,
    total: quote.total,
    notes: quote.notes,
    terms: quote.terms,
  }).select().single()

  if (invErr) return NextResponse.json({ error: invErr.message }, { status: 400 })

  const items = quote.items ?? []
  if (items.length) {
    await db.from('invoice_items').insert(items.map((it: any) => ({
      invoice_id: invoice.id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unit_price,
      amount: it.amount,
    })))
  }

  await db.from('quotations').update({ converted_invoice_id: invoice.id }).eq('id', params.id)

  return NextResponse.json({ success: true, invoice_id: invoice.id, invoice_number })
}
