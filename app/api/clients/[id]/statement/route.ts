import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const db = admin()
  const [{ data: client }, { data: invoices }, { data: quotations }] = await Promise.all([
    db.from('clients').select('id, company_name, email, monthly_retainer').eq('id', params.id).single(),
    db.from('invoices').select('id, invoice_number, status, total, issue_date, due_date, paid_date').eq('client_id', params.id).order('issue_date', { ascending: false }),
    db.from('quotations').select('id, quote_number, status, total, issue_date').eq('client_id', params.id).order('issue_date', { ascending: false }),
  ])
  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const totalInvoiced = (invoices ?? []).reduce((s, i) => s + Number(i.total), 0)
  const totalPaid = (invoices ?? []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
  const outstandingBalance = (invoices ?? []).filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.total), 0)

  return NextResponse.json({
    client,
    summary: { totalInvoiced, totalPaid, outstandingBalance, invoiceCount: (invoices ?? []).length },
    invoices: invoices ?? [],
    quotations: quotations ?? [],
  })
}
