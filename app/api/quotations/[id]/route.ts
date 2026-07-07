import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireFinanceWrite } from '@/lib/apiAuth'
import { isAdmin } from '@/lib/roles'
import { logActivity } from '@/lib/activityLog'
import { computeTotals } from '@/lib/documentTotals'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const CLIENT_DECIDED_STATUSES = ['accepted', 'declined']

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await admin()
    .from('quotations')
    .select('*, client:clients(company_name, email, contact_person, phone, address), items:quotation_items(*)')
    .eq('id', params.id)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceWrite()
  if ('res' in auth) return auth.res

  const body = await req.json()
  const { items, ...quoteData } = body

  // Once a client has formally accepted or declined a quotation, that's a
  // meaningful business record — only an admin/owner may override it
  // (e.g. the client changed their mind by phone/email), not any teammate
  // casually re-clicking the status dropdown.
  if (quoteData.status) {
    const { data: existing } = await admin().from('quotations').select('status').eq('id', params.id).single()
    if (existing && CLIENT_DECIDED_STATUSES.includes(existing.status) && existing.status !== quoteData.status) {
      if (!isAdmin(auth.role)) {
        return NextResponse.json({ error: `Only an admin can change a quotation the client already ${existing.status}` }, { status: 403 })
      }
    }
  }

  if (items) {
    const { subtotal, taxAmount, total } = computeTotals(items, quoteData.discount_type, quoteData.discount_value, quoteData.tax_rate)
    await admin().from('quotation_items').delete().eq('quotation_id', params.id)
    await admin().from('quotation_items').insert(
      items.map((item: { description: string; quantity: number; unit_price: number }, idx: number) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        quotation_id: params.id,
        sort_order: idx,
      }))
    )
    quoteData.subtotal = subtotal
    quoteData.tax_amount = taxAmount
    quoteData.total = total
  }

  const { data, error } = await admin().from('quotations').update(quoteData).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'update', 'quotation', params.id, data.quote_number)
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceWrite()
  if ('res' in auth) return auth.res

  const { data: existing } = await admin().from('quotations').select('quote_number').eq('id', params.id).single()
  const { error } = await admin().from('quotations').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'quotation', params.id, existing?.quote_number)
  return NextResponse.json({ success: true })
}
