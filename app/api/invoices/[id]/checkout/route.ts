import { NextRequest, NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'
import { getStripe } from '@/lib/stripe'

// Intentionally public — clients pay via the emailed invoice link without a session.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let stripe
  try {
    stripe = getStripe()
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }

  const db = serviceRole()
  const { data: invoice, error } = await db
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, status, client:clients(company_name, email)')
    .eq('id', params.id)
    .single()
  if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (invoice.status === 'paid') return NextResponse.json({ error: 'This invoice is already paid' }, { status: 400 })
  if (invoice.status === 'cancelled') return NextResponse.json({ error: 'This invoice was cancelled' }, { status: 400 })

  const remaining = Number(invoice.total) - Number(invoice.amount_paid ?? 0)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const client = invoice.client as any

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: client?.email ?? undefined,
    line_items: [{
      price_data: {
        currency: 'aed',
        unit_amount: Math.round(remaining * 100),
        product_data: {
          name: `Invoice ${invoice.invoice_number}`,
          description: client?.company_name ? `${client.company_name} · MeshMedia` : 'MeshMedia',
        },
      },
      quantity: 1,
    }],
    metadata: { invoice_id: invoice.id, invoice_number: invoice.invoice_number },
    success_url: `${baseUrl}/invoice/${invoice.id}?paid=1`,
    cancel_url: `${baseUrl}/invoice/${invoice.id}?paid=0`,
  })

  return NextResponse.json({ url: session.url })
}
