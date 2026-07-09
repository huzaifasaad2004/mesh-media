import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { FileText, Receipt, FileSpreadsheet, Users } from 'lucide-react'
import FinanceReportPanel from '@/components/finance/FinanceReportPanel'
import CashFlowForecast from '@/components/finance/CashFlowForecast'

export default async function FinancePage() {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]

  const [
    { data: invoices },
    { data: expenses },
    { data: quotations },
    { data: salaries },
  ] = await Promise.all([
    supabase.from('invoices').select('total, amount_paid, status, due_date'),
    supabase.from('expenses').select('amount'),
    supabase.from('quotations').select('total, status'),
    supabase.from('salaries').select('amount, currency').is('effective_to', null),
  ])

  const outstanding = (invoices ?? []).filter(i => ['sent', 'overdue', 'partially_paid'].includes(i.status)).reduce((s, i) => s + ((i.total ?? 0) - (i.amount_paid ?? 0)), 0)
  const overdueCount = (invoices ?? []).filter(i => i.status === 'overdue' || (i.status === 'sent' && i.due_date && i.due_date < today)).length
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  // AED-only: mixing currencies into one number would misrepresent payroll (see docs/BUILD_PLAN.md §C #17)
  const totalSalariesAED = (salaries ?? []).filter(sal => (sal.currency ?? 'AED') === 'AED').reduce((s, sal) => s + (sal.amount ?? 0), 0)
  const hasNonAedSalaries = (salaries ?? []).some(sal => (sal.currency ?? 'AED') !== 'AED')

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
      stat: formatCurrency(totalSalariesAED) + (hasNonAedSalaries ? ' +' : ''),
      statLabel: hasNonAedSalaries ? 'per month (AED only, see Salaries for other currencies)' : 'per month',
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

      {/* Period-aware P&L, revenue trend, and top clients */}
      <FinanceReportPanel />

      {/* Forward-looking cash-flow signal */}
      <CashFlowForecast />

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
