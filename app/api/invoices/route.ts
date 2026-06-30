import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data, error } = await admin()
    .from('invoices')
    .select('*, client:clients(company_name), items:invoice_items(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { items, ...invoiceData } = body
  const total = (items ?? []).reduce((s: number, i: { quantity: number; unit_price: number }) => s + i.quantity * i.unit_price, 0)
  const { data: invoice, error } = await admin()
    .from('invoices')
    .insert({ ...invoiceData, total })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (items?.length) {
    await admin().from('invoice_items').insert(
      items.map((item: { description: string; quantity: number; unit_price: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        invoice_id: invoice.id,
      }))
    )
  }
  return NextResponse.json(invoice)
}
