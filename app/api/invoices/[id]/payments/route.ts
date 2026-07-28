import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { notifyUsers } from '@/lib/notify'
import { sendPaymentReceiptBestEffort } from '@/lib/paymentReceipt'

// Body: { amount, payment_date?, notes? } — records a payment (full or
// partial) against an invoice and recomputes its running amount_paid/status.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceWrite()
  if ('res' in auth) return auth.res
  const db = serviceRole()

  const b = await req.json().catch(() => ({}))
  const amount = Number(b.amount)
  if (!amount || amount <= 0) return NextResponse.json({ error: 'A positive amount is required' }, { status: 400 })

  const { data: invoice, error: invErr } = await db
    .from('invoices')
    .select('id, invoice_number, total, amount_paid, status, client:clients(company_name)')
    .eq('id', params.id)
    .single()
  if (invErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (['paid', 'cancelled'].includes(invoice.status)) {
    return NextResponse.json({ error: `This invoice is already ${invoice.status}` }, { status: 400 })
  }

  const paymentDate = b.payment_date || new Date().toISOString().split('T')[0]
  const remaining = Number(invoice.total) - Number(invoice.amount_paid)
  if (amount > remaining + 0.01) {
    return NextResponse.json({ error: `Amount exceeds the remaining balance of ${remaining.toFixed(2)}` }, { status: 400 })
  }

  const { data: payment, error } = await db.from('invoice_payments').insert({
    invoice_id: invoice.id,
    amount,
    payment_date: paymentDate,
    notes: b.notes || null,
    created_by: auth.user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const newAmountPaid = Number(invoice.amount_paid) + amount
  const isFullyPaid = newAmountPaid >= Number(invoice.total) - 0.01
  const newStatus = isFullyPaid ? 'paid' : 'partially_paid'

  const { data: updated, error: updateErr } = await db.from('invoices').update({
    amount_paid: newAmountPaid,
    status: newStatus,
    paid_date: isFullyPaid ? paymentDate : null,
  }).eq('id', invoice.id).select().single()
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 400 })

  await logActivity(auth.user, 'pay', 'invoice', invoice.id, `${invoice.invoice_number} · ${amount} · ${newStatus}`)

  const { data: admins } = await db.from('profiles').select('id').in('role', ['owner', 'admin'])
  if (admins?.length) {
    await notifyUsers(db, {
      userIds: admins.map(a => a.id),
      title: isFullyPaid ? `Invoice ${invoice.invoice_number} fully paid` : `Partial payment recorded — ${invoice.invoice_number}`,
      body: `${(invoice.client as any)?.company_name ?? ''} · AED ${amount.toLocaleString()}${isFullyPaid ? '' : ` · AED ${(Number(invoice.total) - newAmountPaid).toLocaleString()} remaining`}`,
      href: '/finance/invoices',
      category: 'critical_alert',
    })
  }

  if (isFullyPaid) await sendPaymentReceiptBestEffort(db, invoice.id)

  return NextResponse.json({ payment, invoice: updated })
}
