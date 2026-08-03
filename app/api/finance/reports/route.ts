import { NextRequest, NextResponse } from 'next/server'
import { resolvePeriod, type ReportPeriod, ALL_PERIODS } from '@/lib/reportPeriods'
import { requireFinanceRead, serviceRole } from '@/lib/apiAuth'

type Receipt = {
  date: string
  invoiceId: string
  clientId: string | null
  clientName: string
  amount: number
}

const one = <T,>(value: T | T[] | null | undefined): T | null => Array.isArray(value) ? value[0] ?? null : value ?? null

const netPayment = (amount: number, invoice: { total?: number | null; tax_amount?: number | null } | null) => {
  const total = Number(invoice?.total ?? 0)
  if (total <= 0) return amount
  const preVat = Math.max(0, total - Number(invoice?.tax_amount ?? 0))
  return amount * (preVat / total)
}

const paymentReceipt = (payment: any): Receipt | null => {
  const invoice = one<any>(payment.invoice)
  if (!invoice || !payment.payment_date) return null
  const client = one<any>(invoice.client)
  return {
    date: payment.payment_date,
    invoiceId: payment.invoice_id,
    clientId: invoice.client_id ?? null,
    clientName: client?.company_name ?? 'Unknown',
    amount: netPayment(Number(payment.amount ?? 0), invoice),
  }
}

const legacyReceipt = (invoice: any): Receipt | null => {
  if (!invoice.paid_date || (invoice.payments?.length ?? 0) > 0) return null
  const client = one<any>(invoice.client)
  return {
    date: invoice.paid_date,
    invoiceId: invoice.id,
    clientId: invoice.client_id ?? null,
    clientName: client?.company_name ?? 'Unknown',
    amount: Math.max(0, Number(invoice.total ?? 0) - Number(invoice.tax_amount ?? 0)),
  }
}

const sumByCurrency = (rows: any[], currencyOf: (row: any) => string) => rows.reduce<Record<string, number>>((totals, row) => {
  const currency = currencyOf(row) || 'AED'
  totals[currency] = (totals[currency] ?? 0) + Number(row.amount ?? 0)
  return totals
}, {})

export async function GET(req: NextRequest) {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res

  const periodParam = req.nextUrl.searchParams.get('period') as ReportPeriod | null
  const period: ReportPeriod = periodParam && ALL_PERIODS.includes(periodParam) ? periodParam : 'this_month'
  const { start, end } = resolvePeriod(period)
  const db = serviceRole()

  let paymentQuery = db.from('invoice_payments')
    .select('invoice_id, amount, payment_date, invoice:invoices(total, tax_amount, client_id, client:clients(company_name))')
  let legacyInvoiceQuery = db.from('invoices')
    .select('id, total, tax_amount, paid_date, client_id, client:clients(company_name), payments:invoice_payments(id)')
    .eq('status', 'paid')
  let expenseQuery = db.from('expenses').select('amount, date')
  let salaryPaymentQuery = db.from('salary_payments').select('amount, payment_date, salary:salaries(currency)')

  if (start) {
    paymentQuery = paymentQuery.gte('payment_date', start)
    legacyInvoiceQuery = legacyInvoiceQuery.gte('paid_date', start)
    expenseQuery = expenseQuery.gte('date', start)
    salaryPaymentQuery = salaryPaymentQuery.gte('payment_date', start)
  }
  if (end) {
    paymentQuery = paymentQuery.lte('payment_date', end)
    legacyInvoiceQuery = legacyInvoiceQuery.lte('paid_date', end)
    expenseQuery = expenseQuery.lte('date', end)
    salaryPaymentQuery = salaryPaymentQuery.lte('payment_date', end)
  }

  const trendStartDate = new Date()
  trendStartDate.setUTCMonth(trendStartDate.getUTCMonth() - 11, 1)
  const trendStart = trendStartDate.toISOString().slice(0, 10)
  const trendPaymentsQuery = db.from('invoice_payments')
    .select('invoice_id, amount, payment_date, invoice:invoices(total, tax_amount, client_id, client:clients(company_name))')
    .gte('payment_date', trendStart)
  const trendLegacyQuery = db.from('invoices')
    .select('id, total, tax_amount, paid_date, client_id, client:clients(company_name), payments:invoice_payments(id)')
    .eq('status', 'paid')
    .gte('paid_date', trendStart)

  const [paymentsResult, legacyResult, expensesResult, outstandingResult, salariesResult, salaryPaymentsResult, trendPaymentsResult, trendLegacyResult] = await Promise.all([
    paymentQuery,
    legacyInvoiceQuery,
    expenseQuery,
    db.from('invoices').select('total, amount_paid').in('status', ['sent', 'overdue', 'partially_paid']),
    db.from('salaries').select('amount, currency').is('effective_to', null),
    salaryPaymentQuery,
    trendPaymentsQuery,
    trendLegacyQuery,
  ])

  const firstError = [paymentsResult, legacyResult, expensesResult, outstandingResult, salariesResult, salaryPaymentsResult, trendPaymentsResult, trendLegacyResult]
    .find(result => result.error)?.error
  if (firstError) return NextResponse.json({ error: firstError.message }, { status: 500 })

  const receipts = [
    ...(paymentsResult.data ?? []).map(paymentReceipt).filter(Boolean),
    ...(legacyResult.data ?? []).map(legacyReceipt).filter(Boolean),
  ] as Receipt[]
  const trendReceipts = [
    ...(trendPaymentsResult.data ?? []).map(paymentReceipt).filter(Boolean),
    ...(trendLegacyResult.data ?? []).map(legacyReceipt).filter(Boolean),
  ] as Receipt[]

  const revenue = receipts.reduce((sum, receipt) => sum + receipt.amount, 0)
  const totalExpenses = (expensesResult.data ?? []).reduce((sum, expense) => sum + Number(expense.amount ?? 0), 0)
  const outstanding = (outstandingResult.data ?? []).reduce((sum, invoice) =>
    sum + Math.max(0, Number(invoice.total ?? 0) - Number(invoice.amount_paid ?? 0)), 0)

  const monthlyPayrollByCurrency = sumByCurrency(salariesResult.data ?? [], salary => salary.currency ?? 'AED')
  const payrollPaidByCurrency = sumByCurrency(salaryPaymentsResult.data ?? [], payment => one<any>(payment.salary)?.currency ?? 'AED')
  const payrollPaidAED = payrollPaidByCurrency.AED ?? 0
  const netProfit = revenue - totalExpenses - payrollPaidAED

  const byClient = new Map<string, { name: string; total: number }>()
  for (const receipt of receipts) {
    const key = receipt.clientId ?? receipt.clientName
    const row = byClient.get(key) ?? { name: receipt.clientName, total: 0 }
    row.total += receipt.amount
    byClient.set(key, row)
  }
  const topClients = Array.from(byClient.values()).sort((a, b) => b.total - a.total).slice(0, 8)

  const monthBuckets: Record<string, number> = {}
  for (const receipt of trendReceipts) {
    const key = receipt.date.slice(0, 7)
    monthBuckets[key] = (monthBuckets[key] ?? 0) + receipt.amount
  }
  const trend = Object.entries(monthBuckets).sort(([a], [b]) => a.localeCompare(b)).map(([month, total]) => ({ month, total }))

  return NextResponse.json({
    period,
    start,
    end,
    revenue,
    expenses: totalExpenses,
    outstanding,
    monthlyPayrollByCurrency,
    payrollPaidByCurrency,
    netProfit,
    topClients,
    trend,
    invoiceCount: new Set(receipts.map(receipt => receipt.invoiceId)).size,
    accountingBasis: 'cash_received',
  })
}
