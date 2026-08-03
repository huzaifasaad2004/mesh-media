import { NextResponse } from 'next/server'
import { requireFinanceRead, serviceRole } from '@/lib/apiAuth'

// A simple forward-looking cash-flow projection: recurring retainer income
// (all active clients with a monthly_retainer) + currently outstanding
// invoices (assumed collected in month 1) minus recurring monthly costs
// (active salaries + recurring expenses). Not a full accrual forecast —
// a directional "will we be OK the next few months" signal.
export async function GET() {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const [{ data: clients }, { data: outstandingInvoices }, { data: salaries }, { data: recurringExpenses }] = await Promise.all([
    db.from('clients').select('monthly_retainer').eq('status', 'active').gt('monthly_retainer', 0),
    db.from('invoices').select('total, amount_paid').in('status', ['sent', 'overdue', 'partially_paid']),
    db.from('salaries').select('amount, currency').is('effective_to', null),
    db.from('expenses').select('amount').eq('is_recurring', true),
  ])

  const retainerIncome = (clients ?? []).reduce((s, c) => s + Number(c.monthly_retainer ?? 0), 0)
  const outstanding = (outstandingInvoices ?? []).reduce((s, i) => s + (Number(i.total ?? 0) - Number(i.amount_paid ?? 0)), 0)
  const payrollByCurrency = (salaries ?? []).reduce<Record<string, number>>((totals, salary) => {
    const currency = salary.currency ?? 'AED'
    totals[currency] = (totals[currency] ?? 0) + Number(salary.amount ?? 0)
    return totals
  }, {})
  const monthlyPayroll = payrollByCurrency.AED ?? 0
  const recurringExpenseTotal = (recurringExpenses ?? []).reduce((s, e) => s + Number(e.amount ?? 0), 0)

  const monthlyBurn = monthlyPayroll + recurringExpenseTotal
  const steadyStateNet = retainerIncome - monthlyBurn

  const months = [
    { label: 'This month', net: retainerIncome + outstanding - monthlyBurn },
    { label: 'Next month', net: steadyStateNet },
    { label: 'Month after', net: steadyStateNet },
  ]

  return NextResponse.json({
    retainerIncome, outstanding, monthlyPayroll, payrollByCurrency, recurringExpenseTotal, monthlyBurn, steadyStateNet, months,
    basisCurrency: 'AED',
  })
}
