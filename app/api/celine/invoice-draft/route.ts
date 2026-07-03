// ── app/api/celine/invoice-draft/route.ts (add to the m3m repo) ─────
// Celine creates DRAFT invoices only — a human reviews and sends in m3m.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { celineAuthorized } from '@/lib/celine/auth'
import { emitCelineEvent } from '@/lib/celine/events'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  if (!celineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { client_id, items, notes, due_date, tax_rate } = await req.json()
  if (!client_id || !Array.isArray(items) || !items.length)
    return NextResponse.json({ error: 'client_id and items[] required' }, { status: 400 })

  const { data: invoice, error } = await admin().from('invoices')
    .insert({ client_id, status: 'draft', notes: notes ?? 'Drafted by Celine', due_date: due_date ?? null, tax_rate: tax_rate ?? 0 })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const rows = items.map((it: any, i: number) => ({
    invoice_id: invoice.id,
    description: String(it.description ?? ''),
    quantity: Number(it.quantity ?? 1),
    unit_price: Number(it.unit_price ?? 0),
    amount: Number(it.quantity ?? 1) * Number(it.unit_price ?? 0),
    sort_order: i,
  }))
  const { error: itemErr } = await admin().from('invoice_items').insert(rows)
  if (itemErr) return NextResponse.json({ error: itemErr.message }, { status: 400 })

  await emitCelineEvent('invoice_draft_created', 'admin', {
    invoice_id: invoice.id, invoice_number: invoice.invoice_number, client_id, source: 'celine',
  })
  return NextResponse.json({ ok: true, invoice_id: invoice.id, invoice_number: invoice.invoice_number })
}
