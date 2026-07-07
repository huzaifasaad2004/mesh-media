import { createClient } from '@/lib/supabase/server'
import { formatCurrency, statusColor, statusLabel } from '@/lib/utils'
import { Users, CheckSquare, FileText, DollarSign, TrendingUp, Clock, ArrowUp, ArrowDown, Wallet } from 'lucide-react'
import Link from 'next/link'
import WorkloadPanel from '@/components/WorkloadPanel'
import QuickExpense from '@/components/QuickExpense'
import RevenueChart from '@/components/dashboard/RevenueChart'
import ExpenseDonut from '@/components/dashboard/ExpenseDonut'
import { getEffectivePermissions } from '@/lib/permissions'
import { isAdmin } from '@/lib/roles'

const CAT_LABELS: Record<string, string> = {
  office: 'Office & Rent',
  freelancer: 'Salaries & Freelancers',
  software: 'IT & Software',
  ads: 'Advertising',
  travel: 'Travel',
  other: 'Other',
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const role = profile?.role ?? 'client'

  let permissions = new Set<string>()
  try { permissions = await getEffectivePermissions(supabase, user!.id, role) } catch { /* not migrated yet — degrade to role-only */ }

  const admin = isAdmin(role)
  const hasFinance = admin || permissions.has('finance.read')
  const hasClients = admin || permissions.has('clients.read')

  const [
    { data: tasks },
    { count: tasksDueToday },
  ] = await Promise.all([
    supabase.from('tasks').select('id, title, status, priority, due_date, client:clients(company_name)').neq('status', 'done').order('due_date', { ascending: true }).limit(8),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done').lte('due_date', new Date().toISOString().split('T')[0]),
  ])

  // Scoped queries — only run (and only rendered) for people who actually
  // have permission to see clients/finance data. Team members without that
  // permission never even fetch it, let alone see it on their dashboard.
  let clientCount: number | null = null
  let clients: { id: string; company_name: string; status: string }[] = []
  if (hasClients) {
    const [{ count }, { data }] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('clients').select('id, company_name, status').order('created_at', { ascending: false }).limit(5),
    ])
    clientCount = count
    clients = data ?? []
  }

  let totalRevenue = 0
  let totalExpenses = 0
  let invoiceCount: number | null = null
  let recentInvoices: any[] = []
  let trendData: { label: string; revenue: number; expenses: number }[] = []
  let categoryData: { label: string; amount: number }[] = []
  let revenueDelta: number | null = null

  if (hasFinance) {
    const [{ data: revenueData }, { data: expenseData }, { count: invCount }, { data: recentInv }] = await Promise.all([
      supabase.from('invoices').select('total, tax_amount').eq('status', 'paid'),
      supabase.from('expenses').select('amount, category, date'),
      supabase.from('invoices').select('*', { count: 'exact', head: true }),
      supabase.from('invoices').select('id, invoice_number, total, status, client:clients(company_name)').order('created_at', { ascending: false }).limit(5),
    ])
    invoiceCount = invCount
    recentInvoices = recentInv ?? []

    // Revenue is pre-VAT — tax_amount is 0 today since VAT isn't in use
    totalRevenue = revenueData?.reduce((sum, inv) => sum + ((inv.total || 0) - (inv.tax_amount || 0)), 0) ?? 0
    totalExpenses = expenseData?.reduce((sum, e) => sum + (e.amount || 0), 0) ?? 0

    // Revenue vs expenses over the last 6 months
    const monthKey = (d: string) => d.slice(0, 7) // YYYY-MM
    const monthLabel = (key: string) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short' })

    const now = new Date()
    const months: string[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    }

    const { data: paidInvoicesForTrend } = await supabase
      .from('invoices')
      .select('total, tax_amount, issue_date')
      .eq('status', 'paid')

    const revenueByMonth = new Map<string, number>()
    for (const inv of paidInvoicesForTrend ?? []) {
      if (!inv.issue_date) continue
      const key = monthKey(inv.issue_date)
      revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + ((inv.total || 0) - (inv.tax_amount || 0)))
    }

    const expensesByMonth = new Map<string, number>()
    for (const e of expenseData ?? []) {
      if (!e.date) continue
      const key = monthKey(e.date)
      expensesByMonth.set(key, (expensesByMonth.get(key) ?? 0) + (e.amount || 0))
    }

    trendData = months.map((key) => ({
      label: monthLabel(key),
      revenue: revenueByMonth.get(key) ?? 0,
      expenses: expensesByMonth.get(key) ?? 0,
    }))

    const thisMonthRevenue = trendData[trendData.length - 1]?.revenue ?? 0
    const lastMonthRevenue = trendData[trendData.length - 2]?.revenue ?? 0
    revenueDelta = lastMonthRevenue > 0 ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100 : null

    // Expenses by category (all-time)
    const expenseByCategory = new Map<string, number>()
    for (const e of expenseData ?? []) {
      expenseByCategory.set(e.category, (expenseByCategory.get(e.category) ?? 0) + (e.amount || 0))
    }
    categoryData = Array.from(expenseByCategory.entries())
      .map(([cat, amount]) => ({ label: CAT_LABELS[cat] ?? cat, amount }))
      .sort((a, b) => b.amount - a.amount)
  }

  // Non-finance staff get their own salary instead of company financials —
  // RLS already scopes `salaries` to admins or the row's own profile_id.
  let mySalary: { amount: number; currency: string; pay_period: string } | null = null
  if (!hasFinance) {
    const { data } = await supabase
      .from('salaries')
      .select('amount, currency, pay_period')
      .eq('profile_id', user!.id)
      .is('effective_to', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    mySalary = data
  }

  const stats: any[] = [
    { label: 'Open Tasks', value: (tasks?.length ?? 0), icon: CheckSquare, color: 'text-umber-700', bg: 'bg-paper-200', href: '/tasks' },
    { label: 'Due Today', value: tasksDueToday ?? 0, icon: Clock, color: 'text-[#B8801F]', bg: 'bg-[#F6ECD6]', href: '/tasks' },
  ]
  if (hasClients) {
    stats.push({ label: 'Active Clients', value: clientCount ?? 0, icon: Users, color: 'text-brand-600', bg: 'bg-brand-50', href: '/clients' })
  }
  if (hasFinance) {
    stats.push(
      { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-[#4F7A4A]', bg: 'bg-[#E7EFE3]', href: '/finance', delta: revenueDelta },
      { label: 'Expenses', value: formatCurrency(totalExpenses), icon: TrendingUp, color: 'text-[#B23A2E]', bg: 'bg-[#F4E0DC]', href: '/finance' },
      { label: 'Invoices', value: invoiceCount ?? 0, icon: FileText, color: 'text-brand-600', bg: 'bg-brand-50', href: '/finance/invoices' },
    )
  } else if (mySalary) {
    stats.push({
      label: 'My Salary', value: formatCurrency(mySalary.amount, mySalary.currency), icon: Wallet,
      color: 'text-[#4F7A4A]', bg: 'bg-[#E7EFE3]', href: '/my-pay',
    })
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back to Mesh Media</p>
        </div>
        {hasFinance && <QuickExpense />}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href, delta }: any) => (
          <Link key={label} href={href}>
            <div className="stat-card hover:shadow-md transition-shadow cursor-pointer">
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="stat-number text-ink">{value}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-taupe-600">{label}</p>
                {typeof delta === 'number' && (
                  <span className={`text-[10px] font-semibold flex items-center ${delta >= 0 ? 'text-[#4F7A4A]' : 'text-[#B23A2E]'}`}>
                    {delta >= 0 ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                    {Math.abs(delta).toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Revenue vs expenses + category breakdown — finance.read only */}
      {hasFinance && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Revenue vs Expenses</h3>
              <Link href="/finance" className="text-xs text-brand-600 hover:underline font-medium">Open Finance →</Link>
            </div>
            <div className="p-5">
              <RevenueChart data={trendData} />
            </div>
          </div>
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Expenses by Category</h3>
              <Link href="/finance/expenses" className="text-xs text-brand-600 hover:underline font-medium">Open Expenses →</Link>
            </div>
            <div className="p-5">
              <ExpenseDonut data={categoryData} />
            </div>
          </div>
        </div>
      )}

      {/* Manager-only team workload (self-hides for others) */}
      <WorkloadPanel />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Open Tasks */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3>Open Tasks</h3>
            <Link href="/tasks" className="text-xs text-brand-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {tasks && tasks.length > 0 ? tasks.map((task: any) => (
              <div key={task.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
                  {task.client && (
                    <p className="text-xs text-gray-400 mt-0.5">{task.client.company_name}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {task.due_date && (
                    <span className="text-xs text-gray-400">{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                  )}
                  <span className={`badge ${statusColor(task.priority)}`}>{task.priority}</span>
                </div>
              </div>
            )) : (
              <div className="px-5 py-8 text-center text-sm text-gray-400">No open tasks</div>
            )}
          </div>
        </div>

        {/* Recent Clients — clients.read only */}
        {hasClients && (
          <div className="card">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Recent Clients</h3>
              <Link href="/clients" className="text-xs text-brand-600 hover:underline font-medium">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {clients.length > 0 ? clients.map((client: any) => (
                <Link key={client.id} href={`/clients/${client.id}`}>
                  <div className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                        {client.company_name[0]}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{client.company_name}</span>
                    </div>
                    <span className={`badge ${statusColor(client.status)}`}>{statusLabel(client.status)}</span>
                  </div>
                </Link>
              )) : (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No clients yet</div>
              )}
            </div>
          </div>
        )}

        {/* Recent Invoices — finance.read only */}
        {hasFinance && (
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3>Recent Invoices</h3>
              <Link href="/finance" className="text-xs text-brand-600 hover:underline font-medium">View all</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Invoice</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentInvoices.length > 0 ? recentInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-brand-600">{inv.invoice_number}</td>
                      <td className="px-5 py-3 text-gray-700">{inv.client?.company_name ?? '—'}</td>
                      <td className="px-5 py-3 font-medium">{formatCurrency(inv.total)}</td>
                      <td className="px-5 py-3"><span className={`badge ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-400">No invoices yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
