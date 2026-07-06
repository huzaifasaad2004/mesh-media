import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceRead, requireRoles, serviceRole, stripProtected, FINANCE_WRITE } from '@/lib/apiAuth'
import { computeTotals } from '@/lib/documentTotals'

export async function GET() {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res
  const { data, error } = await serviceRole()
    .from('quotations')
    .select('*, client:clients(company_name, email, contact_person, phone, address), items:quotation_items(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(FINANCE_WRITE, 'finance.write')
  if ('res' in auth) return auth.res
  const body = await req.json()
  const { items, ...rest } = body
  const quoteData = stripProtected(rest)
  const { subtotal, taxAmount, total } = computeTotals(items ?? [], quoteData.discount_type as string, quoteData.discount_value as number, quoteData.tax_rate as number)

  const { data: quote, error } = await serviceRole()
    .from('quotations')
    .insert({ ...quoteData, subtotal, tax_amount: taxAmount, total })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (items?.length) {
    await serviceRole().from('quotation_items').insert(
      items.map((item: { description: string; quantity: number; unit_price: number }, idx: number) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        quotation_id: quote.id,
        sort_order: idx,
      }))
    )
  }
  return NextResponse.json(quote)
}
