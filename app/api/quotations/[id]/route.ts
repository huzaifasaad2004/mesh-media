import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireFinanceWrite } from '@/lib/apiAuth'
import { isAdmin } from '@/lib/roles'
import { logActivity } from '@/lib/activityLog'
import { computeTotals } from '@/lib/documentTotals'
import { emitAutomationEvent } from '@/lib/automations/engine'

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
  const { data: before } = await admin().from('quotations').select('status').eq('id', params.id).single()

  // Once a client has formally accepted or declined a quotation, that's a
  // meaningful business record — only an admin/owner may override it
  // (e.g. the client changed their mind by phone/email), not any teammate
  // casually re-clicking the status dropdown.
  if (quoteData.status) {
    if (before && CLIENT_DECIDED_STATUSES.includes(before.status) && before.status !== quoteData.status) {
      if (!isAdmin(auth.role)) {
        return NextResponse.json({ error: `Only an admin can change a quotation the client already ${before.status}` }, { status: 403 })
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
  if (data.status === 'accepted' && before?.status !== 'accepted') {
    const { data: client } = await admin().from('clients').select('company_name').eq('id', data.client_id).single()
    await emitAutomationEvent('quotation_accepted', {
      eventKey: data.id, actorId: auth.user.id, entityId: data.id, entityType: 'quotation', clientId: data.client_id,
      values: { quote_number: data.quote_number, client_name: client?.company_name, company_name: client?.company_name, total: data.total, status: data.status },
    })
  }
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
