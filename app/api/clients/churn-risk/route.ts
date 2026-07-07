import { NextResponse } from 'next/server'
import { requireFinanceRead, serviceRole } from '@/lib/apiAuth'
import { computeChurnRisk } from '@/lib/churnRisk'

// Gated by finance.read since overdue-invoice data drives most of the
// score — same sensitivity level as the rest of the finance module.
export async function GET() {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const sixMonthsAgo = new Date(Date.now() - 183 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: clients }, { data: invoices }, { data: tasks }, { data: notes }] = await Promise.all([
    db.from('clients').select('id, status, monthly_retainer').neq('status', 'churned'),
    db.from('invoices').select('client_id, status, due_date, issue_date').gte('issue_date', sixMonthsAgo),
    db.from('tasks').select('client_id, created_at').not('client_id', 'is', null),
    db.from('client_notes').select('client_id, created_at'),
  ])

  const invoicesByClient = new Map<string, typeof invoices>()
  for (const inv of invoices ?? []) {
    if (!inv.client_id) continue
    if (!invoicesByClient.has(inv.client_id)) invoicesByClient.set(inv.client_id, [])
    invoicesByClient.get(inv.client_id)!.push(inv)
  }

  const lastTaskByClient = new Map<string, string>()
  for (const t of tasks ?? []) {
    if (!t.client_id) continue
    const existing = lastTaskByClient.get(t.client_id)
    if (!existing || t.created_at > existing) lastTaskByClient.set(t.client_id, t.created_at)
  }

  const lastNoteByClient = new Map<string, string>()
  for (const n of notes ?? []) {
    if (!n.client_id) continue
    const existing = lastNoteByClient.get(n.client_id)
    if (!existing || n.created_at > existing) lastNoteByClient.set(n.client_id, n.created_at)
  }

  const results = (clients ?? []).map((c) => {
    const result = computeChurnRisk({
      status: c.status,
      monthlyRetainer: c.monthly_retainer,
      invoices: (invoicesByClient.get(c.id) ?? []) as any,
      lastTaskAt: lastTaskByClient.get(c.id) ?? null,
      lastNoteAt: lastNoteByClient.get(c.id) ?? null,
    })
    return { client_id: c.id, ...result }
  })

  return NextResponse.json(results)
}
