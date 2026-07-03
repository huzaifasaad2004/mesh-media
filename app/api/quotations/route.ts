import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeTotals } from '@/lib/documentTotals'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data, error } = await admin()
    .from('quotations')
    .select('*, client:clients(company_name, email, contact_person, phone, address), items:quotation_items(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { items, ...quoteData } = body
  const { subtotal, taxAmount, total } = computeTotals(items ?? [], quoteData.discount_type, quoteData.discount_value, quoteData.tax_rate)

  const { data: quote, error } = await admin()
    .from('quotations')
    .insert({ ...quoteData, subtotal, tax_amount: taxAmount, total })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (items?.length) {
    await admin().from('quotation_items').insert(
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
