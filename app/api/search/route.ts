import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  if (q.length < 2) return NextResponse.json([])

  const { db } = auth
  const like = `%${q}%`

  const [clients, invoices, quotations, tasks, contracts] = await Promise.all([
    db.from('clients').select('id, company_name').ilike('company_name', like).limit(5),
    db.from('invoices').select('id, invoice_number, client:clients(company_name)').ilike('invoice_number', like).limit(5),
    db.from('quotations').select('id, quote_number, client:clients(company_name)').ilike('quote_number', like).limit(5),
    db.from('tasks').select('id, title').ilike('title', like).limit(5),
    db.from('contracts').select('id, title').ilike('title', like).limit(5),
  ])

  const results = [
    ...(clients.data ?? []).map((c: any) => ({ type: 'Client', label: c.company_name, href: `/clients/${c.id}` })),
    ...(invoices.data ?? []).map((i: any) => ({ type: 'Invoice', label: `${i.invoice_number} · ${i.client?.company_name ?? ''}`, href: `/invoice/${i.id}` })),
    ...(quotations.data ?? []).map((qt: any) => ({ type: 'Quotation', label: `${qt.quote_number} · ${qt.client?.company_name ?? ''}`, href: `/quotation/${qt.id}` })),
    ...(tasks.data ?? []).map((t: any) => ({ type: 'Task', label: t.title, href: `/tasks` })),
    ...(contracts.data ?? []).map((c: any) => ({ type: 'Contract', label: c.title, href: `/contracts` })),
  ]

  return NextResponse.json(results)
}
