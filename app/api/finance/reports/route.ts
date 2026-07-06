import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { resolvePeriod, type ReportPeriod, ALL_PERIODS } from '@/lib/reportPeriods'
import { requireFinanceRead } from '@/lib/apiAuth'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(req: NextRequest) {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res

  const periodParam = req.nextUrl.searchParams.get('period') as ReportPeriod | null
  const period: ReportPeriod = periodParam && ALL_PERIODS.includes(periodParam) ? periodParam : 'this_month'
  const { start, end } = resolvePeriod(period)

  const db = admin()

  // Revenue is recognized pre-VAT (VAT collected is a liability owed to the
  // tax authority, not agency income) — always total minus tax_amount.
  // tax_amount is 0 today since VAT isn't in use, so this is a no-op until it is.
  let invoiceQuery = db.from('invoices').select('id, total, tax_amount, status, paid_date, client_id, client:clients(company_name)').eq('status', 'paid')
  if (start) invoiceQuery = invoiceQuery.gte('paid_date', start)
  if (end) invoiceQuery = invoiceQuery.lte('paid_date', end)

  let expenseQuery = db.from('expenses').select('amount, date')
  if (start) expenseQuery = expenseQuery.gte('date', start)
  if (end) expenseQuery = expenseQuery.lte('date', end)

  const [{ data: paidInvoices }, { data: expenses }, { data: outstandingInvoices }, { data: salaries }, { data: last12moInvoices }] =
    await Promise.all([
      invoiceQuery,
      expenseQuery,
      db.from('invoices').select('total').in('status', ['sent', 'overdue']),
      db.from('salaries').select('amount, currency').is('effective_to', null),
      db.from('invoices').select('total, tax_amount, paid_date').eq('status', 'paid').gte('paid_date', new Date(new Date().setMonth(new Date().getMonth() - 11)).toISOString().split('T')[0]),
    ])

  const netOf = (i: { total: number; tax_amount?: number | null }) => Number(i.total) - Number(i.tax_amount ?? 0)
  const revenue = (paidInvoices ?? []).reduce((s, i) => s + netOf(i), 0)
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
  const outstanding = (outstandingInvoices ?? []).reduce((s, i) => s + Number(i.total), 0)
  // Salaries are a recurring monthly commitment, not something to prorate per arbitrary period —
  // shown as a flat run-rate figure. Only AED-denominated salaries roll into AED net profit math.
  const monthlyPayrollAED = (salaries ?? []).filter(s => (s.currency ?? 'AED') === 'AED').reduce((s, sal) => s + Number(sal.amount), 0)
  const netProfit = revenue - totalExpenses - monthlyPayrollAED

  // Top clients by paid revenue (pre-VAT) in this period
  const byClient = new Map<string, { name: string; total: number }>()
  for (const inv of paidInvoices ?? []) {
    const name = (inv as any).client?.company_name ?? 'Unknown'
    const key = inv.client_id ?? name
    const row = byClient.get(key) ?? { name, total: 0 }
    row.total += netOf(inv)
    byClient.set(key, row)
  }
  const topClients = Array.from(byClient.values()).sort((a, b) => b.total - a.total).slice(0, 8)

  // Revenue trend: last 12 months, bucketed (pre-VAT)
  const monthBuckets: Record<string, number> = {}
  for (const inv of last12moInvoices ?? []) {
    if (!inv.paid_date) continue
    const key = inv.paid_date.slice(0, 7) // YYYY-MM
    monthBuckets[key] = (monthBuckets[key] ?? 0) + netOf(inv)
  }
  const trend = Object.entries(monthBuckets).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }))

  return NextResponse.json({
    period, start, end,
    revenue, expenses: totalExpenses, outstanding, monthlyPayrollAED, netProfit,
    topClients, trend,
    invoiceCount: (paidInvoices ?? []).length,
  })
}
