import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

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
  const body = await req.json()
  const { items, ...quoteData } = body

  if (items) {
    const total = items.reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
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
    quoteData.subtotal = total
    quoteData.total = total
  }

  const { data, error } = await admin().from('quotations').update(quoteData).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await admin().from('quotations').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
