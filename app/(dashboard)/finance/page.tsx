import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'
import { Plus, TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react'

export default async function FinancePage() {
  const supabase = createClient()

  const [
    { data: invoices },
    { data: expenses },
    { data: salaries },
    { data: salaryPayments },
  ] = await Promise.all([
    supabase.from('invoices').select('*, client:clients(company_name), items:invoice_items(*)').order('created_at', { ascending: false }),
    supabase.from('expenses').select('*, client:clients(company_name)').order('date', { ascending: false }),
    supabase.from('salaries').select('*, profile:profiles(full_name, email)').order('effective_from', { ascending: false }),
    supabase.from('salary_payments').select('*, profile:profiles(full_name)').order('payment_date', { ascending: false }).limit(10),
  ])

  const totalRevenue = invoices?.filter((i: any) => i.status === 'paid').reduce((s: number, i: any) => s + (i.total ?? 0), 0) ?? 0
  const outstanding = invoices?.filter((i: any) => ['sent', 'overdue'].includes(i.status)).reduce((s: number, i: any) => s + (i.total ?? 0), 0) ?? 0
  const totalExpenses = expenses?.reduce((s: number, e: any) => s + (e.amount ?? 0), 0) ?? 0
  const totalSalaries = salaries?.reduce((s: number, sal: any) => s + (sal.amount ?? 0), 0) ?? 0
  const netProfit = totalRevenue - totalExpenses - totalSalaries

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', trend: 'positive' },
    { label: 'Outstanding', value: formatCurrency(outstanding), icon: Receipt, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Salary Costs', value: formatCurrency(totalSalaries) + '/mo', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Net Profit', value: formatCurrency(netProfit), icon: TrendingUp, color: netProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Revenue, expenses, invoices & salaries</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary"><Plus className="w-4 h-4" /> Add Expense</button>
          <button className="btn-primary"><Plus className="w-4 h-4" /> New Invoice</button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3>Invoices</h3>
            <button className="btn-primary btn-sm"><Plus className="w-3 h-3" /> New</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Invoice</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices && invoices.length > 0 ? (invoices as any[]).map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td className="px-5 py-3 font-medium text-brand-600">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-gray-600">{inv.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold">{formatCurrency(inv.total)}</td>
                  <td className="px-5 py-3"><span className={`badge ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No invoices yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Expenses */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3>Expenses</h3>
            <button className="btn-secondary btn-sm"><Plus className="w-3 h-3" /> Add</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Description</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Category</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses && expenses.length > 0 ? (expenses as any[]).slice(0, 10).map((exp) => (
                <tr key={exp.id} className="table-row">
                  <td className="px-5 py-3 text-gray-900">{exp.description}</td>
                  <td className="px-5 py-3"><span className="badge bg-gray-100 text-gray-600">{exp.category}</span></td>
                  <td className="px-5 py-3 font-semibold text-red-700">−{formatCurrency(exp.amount)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(exp.date)}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400 text-sm">No expenses recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Salaries */}
        <div className="card overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3>Team Salaries</h3>
            <span className="text-sm font-semibold text-gray-700">{formatCurrency(totalSalaries)}/mo total</span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Team Member</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Salary</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Pay Period</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Effective From</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {salaries && salaries.length > 0 ? (salaries as any[]).map((sal) => (
                <tr key={sal.id} className="table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {(sal.profile?.full_name ?? 'U')[0]}
                      </div>
                      <span className="font-medium text-gray-900">{sal.profile?.full_name ?? sal.profile?.email ?? '—'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900">{formatCurrency(sal.amount)} <span className="text-gray-400 font-normal">{sal.currency}</span></td>
                  <td className="px-5 py-3 text-gray-500 capitalize">{sal.pay_period}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs">{formatDate(sal.effective_from)}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${sal.effective_to ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                      {sal.effective_to ? 'Ended' : 'Active'}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No salaries configured — go to Team to set them up</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
