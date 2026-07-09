import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceRead } from '@/lib/apiAuth'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res
  const db = auth.db // RLS-scoped
  const [{ data: client }, { data: invoices }, { data: quotations }] = await Promise.all([
    db.from('clients').select('id, company_name, email, monthly_retainer').eq('id', params.id).single(),
    db.from('invoices').select('id, invoice_number, status, total, amount_paid, issue_date, due_date, paid_date').eq('client_id', params.id).order('issue_date', { ascending: false }),
    db.from('quotations').select('id, quote_number, status, total, issue_date').eq('client_id', params.id).order('issue_date', { ascending: false }),
  ])
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const totalInvoiced = (invoices ?? []).reduce((s, i) => s + Number(i.total), 0)
  const totalPaid = (invoices ?? []).reduce((s, i) => s + Number(i.status === 'paid' ? i.total : i.amount_paid ?? 0), 0)
  const outstandingBalance = (invoices ?? []).filter(i => ['sent', 'overdue', 'partially_paid'].includes(i.status)).reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid ?? 0)), 0)

  return NextResponse.json({
    client,
    summary: { totalInvoiced, totalPaid, outstandingBalance, invoiceCount: (invoices ?? []).length },
    invoices: invoices ?? [],
    quotations: quotations ?? [],
  })
}
