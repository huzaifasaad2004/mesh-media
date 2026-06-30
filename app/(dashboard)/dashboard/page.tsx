import { createClient } from '@/lib/supabase/server'
import { formatCurrency, statusColor, statusLabel } from '@/lib/utils'
import { Users, CheckSquare, FileText, DollarSign, TrendingUp, Clock } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = createClient()

  const [
    { count: clientCount },
    { data: clients },
    { data: tasks },
    { count: tasksDueToday },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('clients').select('id, company_name, status').order('created_at', { ascending: false }).limit(5),
    supabase.from('tasks').select('id, title, status, priority, due_date, client:clients(company_name)').neq('status', 'done').order('due_date', { ascending: true }).limit(8),
    supabase.from('tasks').select('*', { count: 'exact', head: true }).neq('status', 'done').lte('due_date', new Date().toISOString().split('T')[0]),
    supabase.from('invoices').select('id, invoice_number, total, status, client:clients(company_name)').order('created_at', { ascending: false }).limit(5),
  ])

  const { data: revenueData } = await supabase
    .from('invoices')
    .select('total')
    .eq('status', 'paid')

  const totalRevenue = revenueData?.reduce((sum, inv) => sum + (inv.total || 0), 0) ?? 0

  const { data: expenseData } = await supabase
    .from('expenses')
    .select('amount')

  const totalExpenses = expenseData?.reduce((sum, e) => sum + (e.amount || 0), 0) ?? 0

  const stats = [
    { label: 'Active Clients', value: clientCount ?? 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', href: '/clients' },
    { label: 'Open Tasks', value: (tasks?.length ?? 0), icon: CheckSquare, color: 'text-purple-600', bg: 'bg-purple-50', href: '/tasks' },
    { label: 'Due Today', value: tasksDueToday ?? 0, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50', href: '/tasks' },
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50', href: '/finance' },
    { label: 'Expenses', value: formatCurrency(totalExpenses), icon: TrendingUp, color: 'text-red-600', bg: 'bg-red-50', href: '/finance' },
    { label: 'Invoices', value: recentInvoices?.length ?? 0, icon: FileText, color: 'text-brand-600', bg: 'bg-brand-50', href: '/contracts' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Welcome back to Mesh Media</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <div className="stat-card hover:shadow-md transition-shadow cursor-pointer">
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </Link>
        ))}
      </div>

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

        {/* Recent Clients */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3>Recent Clients</h3>
            <Link href="/clients" className="text-xs text-brand-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="divide-y divide-gray-50">
            {clients && clients.length > 0 ? clients.map((client: any) => (
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

        {/* Recent Invoices */}
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
                {recentInvoices && recentInvoices.length > 0 ? recentInvoices.map((inv: any) => (
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
      </div>
    </div>
  )
}
