import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceWrite()
  if ('res' in auth) return auth.res
  const db = serviceRole()

  const b = await req.json()
  const patch: Record<string, unknown> = {}
  if (b.payment_date !== undefined) patch.payment_date = b.payment_date
  if (b.amount !== undefined) patch.amount = Number(b.amount)
  if (b.notes !== undefined) patch.notes = b.notes || null
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data: payment, error } = await db.from('invoice_payments').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Recompute the invoice's running total/status from the full payment history —
  // an amount edit can move an invoice between partially_paid and paid.
  const { data: invoice } = await db.from('invoices').select('id, invoice_number, total').eq('id', payment.invoice_id).single()
  if (invoice) {
    const { data: allPayments } = await db.from('invoice_payments').select('amount, payment_date').eq('invoice_id', invoice.id)
    const amountPaid = (allPayments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const isFullyPaid = amountPaid >= Number(invoice.total) - 0.01
    const latestDate = (allPayments ?? []).map(p => p.payment_date).sort().pop() ?? null
    await db.from('invoices').update({
      amount_paid: amountPaid,
      status: isFullyPaid ? 'paid' : 'partially_paid',
      paid_date: isFullyPaid ? latestDate : null,
    }).eq('id', invoice.id)
    await logActivity(auth.user, 'update', 'invoice_payment', params.id, `${invoice.invoice_number} payment → ${patch.amount ?? payment.amount}`)
  }

  return NextResponse.json(payment)
}
