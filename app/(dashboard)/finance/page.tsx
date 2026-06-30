import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { FileText, Receipt, FileSpreadsheet, Users, TrendingUp, TrendingDown, DollarSign, AlertCircle } from 'lucide-react'

export default async function FinancePage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: invoices },
    { data: expenses },
    { data: quotations },
    { data: salaries },
  ] = await Promise.all([
    supabase.from('invoices').select('total, status, due_date'),
    supabase.from('expenses').select('amount'),
    supabase.from('quotations').select('total, status'),
    supabase.from('salaries').select('amount').is('effective_to', null),
  ])

  const totalRevenue = (invoices ?? []).filter(i => i.status === 'paid').reduce((s, i) => s + (i.total ?? 0), 0)
  const outstanding = (invoices ?? []).filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total ?? 0), 0)
  const overdueCount = (invoices ?? []).filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date && i.due_date < today)).length
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalSalaries = (salaries ?? []).reduce((s, sal) => s + (sal.amount ?? 0), 0)
  const netProfit = totalRevenue - totalExpenses - totalSalaries

  const modules = [
    {
      href: '/finance/invoices',
      label: 'Invoices',
      description: `${(invoices ?? []).length} total · ${overdueCount > 0 ? `${overdueCount} overdue` : 'all clear'}`,
      icon: FileText,
      accent: '#6E1318',
      stat: formatCurrency(outstanding),
      statLabel: 'outstanding',
    },
    {
      href: '/finance/quotations',
      label: 'Quotations',
      description: `${(quotations ?? []).length} total`,
      icon: FileSpreadsheet,
      accent: '#1d4ed8',
      stat: formatCurrency((quotations ?? []).filter(q => q.status === 'accepted').reduce((s, q) => s + (q.total ?? 0), 0)),
      statLabel: 'accepted',
    },
    {
      href: '/finance/expenses',
      label: 'Expenses',
      description: `${(expenses ?? []).length} records`,
      icon: Receipt,
      accent: '#b45309',
      stat: formatCurrency(totalExpenses),
      statLabel: 'this period',
    },
    {
      href: '/finance/salaries',
      label: 'Salaries',
      description: `${(salaries ?? []).length} active`,
      icon: Users,
      accent: '#059669',
      stat: formatCurrency(totalSalaries),
      statLabel: 'per month',
    },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Invoices, quotations, expenses & salaries</p>
        </div>
      </div>

      {/* P&L summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Revenue Collected', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Outstanding', value: formatCurrency(outstanding), icon: AlertCircle, color: overdueCount > 0 ? 'text-red-600' : 'text-orange-600', bg: overdueCount > 0 ? 'bg-red-50' : 'bg-orange-50' },
          { label: 'Total Expenses', value: formatCurrency(totalExpenses + totalSalaries), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Net Profit', value: formatCurrency(netProfit), icon: TrendingUp, color: netProfit >= 0 ? 'text-green-700' : 'text-red-600', bg: netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-2 gap-5">
        {modules.map(({ href, label, description, icon: Icon, accent, stat, statLabel }) => (
          <Link key={href} href={href} className="card p-6 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent + '15' }}>
                <Icon className="w-5 h-5" style={{ color: accent }} />
              </div>
              <span className="text-xs text-gray-400 group-hover:text-brand-600 transition-colors">Open →</span>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">{label}</h3>
            <p className="text-xs text-gray-500 mb-4">{description}</p>
            <div>
              <p className="text-2xl font-bold" style={{ color: accent }}>{stat}</p>
              <p className="text-xs text-gray-400 mt-0.5">{statLabel}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
