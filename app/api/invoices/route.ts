import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceRead, requireFinanceWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { computeTotals } from '@/lib/documentTotals'

export async function GET() {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res
  const { data, error } = await serviceRole()
    .from('invoices')
    .select('*, client:clients(company_name), items:invoice_items(*)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireFinanceWrite()
  if ('res' in auth) return auth.res
  const body = await req.json()
  const { items, ...rest } = body
  const invoiceData = stripProtected(rest)
  const { subtotal, taxAmount, total } = computeTotals(items ?? [], invoiceData.discount_type as string, invoiceData.discount_value as number, invoiceData.tax_rate as number)
  invoiceData.subtotal = subtotal
  invoiceData.tax_amount = taxAmount
  // If someone records a historical invoice as already paid, stamp paid_date immediately
  if (invoiceData.status === 'paid' && !invoiceData.paid_date) {
    invoiceData.paid_date = new Date().toISOString().split('T')[0]
  }
  const { data: invoice, error } = await serviceRole()
    .from('invoices')
    .insert({ ...invoiceData, total })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (items?.length) {
    await serviceRole().from('invoice_items').insert(
      items.map((item: { description: string; quantity: number; unit_price: number }) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        invoice_id: invoice.id,
      }))
    )
  }
  await logActivity(auth.user, 'create', 'invoice', invoice.id, invoice.invoice_number)
  return NextResponse.json(invoice)
}
