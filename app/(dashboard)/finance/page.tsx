'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, TrendingUp, TrendingDown, DollarSign, Receipt, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import InvoiceForm from '@/components/forms/InvoiceForm'
import ExpenseForm from '@/components/forms/ExpenseForm'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'

type Tab = 'invoices' | 'expenses' | 'salaries'

export default function FinancePage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [salaries, setSalaries] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('invoices')
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    const [invRes, expRes] = await Promise.all([
      fetch('/api/invoices'),
      fetch('/api/expenses'),
    ])
    const [invData, expData] = await Promise.all([invRes.json(), expRes.json()])
    setInvoices(Array.isArray(invData) ? invData : [])
    setExpenses(Array.isArray(expData) ? expData : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    fetch('/api/clients').then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : []))
    // fetch salaries via supabase client for read-only display
    import('@/lib/supabase/client').then(({ createClient }) => {
      const sb = createClient()
      sb.from('salaries').select('*, profile:profiles(full_name, email)').order('effective_from', { ascending: false })
        .then(({ data }) => setSalaries(data ?? []))
    })
  }, [fetchData])

  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const totalRevenue = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (i.total ?? 0), 0)
  const outstanding = invoices.filter((i) => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total ?? 0), 0)
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalSalaries = salaries.filter((s) => !s.effective_to).reduce((s, sal) => s + (sal.amount ?? 0), 0)
  const netProfit = totalRevenue - totalExpenses - totalSalaries

  const stats = [
    { label: 'Total Revenue', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Outstanding', value: formatCurrency(outstanding), icon: Receipt, color: 'text-orange-600', bg: 'bg-orange-50' },
    { label: 'Total Expenses', value: formatCurrency(totalExpenses), icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Salary Costs', value: formatCurrency(totalSalaries) + '/mo', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
    { label: 'Net Profit', value: formatCurrency(netProfit), icon: TrendingUp, color: netProfit >= 0 ? 'text-green-600' : 'text-red-600', bg: netProfit >= 0 ? 'bg-green-50' : 'bg-red-50' },
  ]

  const tabs: { key: Tab; label: string }[] = [
    { key: 'invoices', label: 'Invoices' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'salaries', label: 'Salaries' },
  ]

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Finance</h1>
          <p className="text-gray-500 text-sm mt-0.5">Revenue, expenses, invoices & salaries</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowExpenseModal(true)}>
            <Plus className="w-4 h-4" /> Add Expense
          </button>
          <button className="btn-primary" onClick={() => setShowInvoiceModal(true)}>
            <Plus className="w-4 h-4" /> New Invoice
          </button>
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

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
      ) : activeTab === 'invoices' ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3>Invoices</h3>
            <button className="btn-primary btn-sm" onClick={() => setShowInvoiceModal(true)}>
              <Plus className="w-3 h-3" /> New
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Invoice</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Date</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length > 0 ? invoices.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td className="px-5 py-3 font-medium text-brand-600">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-gray-600">{inv.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold">{formatCurrency(inv.total)}</td>
                  <td className="px-5 py-3"><span className={`badge ${statusColor(inv.status)}`}>{statusLabel(inv.status)}</span></td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(inv.issue_date)}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => deleteInvoice(inv.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">No invoices yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'expenses' ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3>Expenses</h3>
            <button className="btn-secondary btn-sm" onClick={() => setShowExpenseModal(true)}>
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Description</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Category</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-5 py-2.5 text-xs font-semibold text-gray-500">Date</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.length > 0 ? expenses.map((exp) => (
                <tr key={exp.id} className="table-row">
                  <td className="px-5 py-3 text-gray-900">{exp.description}</td>
                  <td className="px-5 py-3"><span className="badge bg-gray-100 text-gray-600">{exp.category}</span></td>
                  <td className="px-5 py-3 font-semibold text-red-700">−{formatCurrency(exp.amount)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(exp.date)}</td>
                  <td className="px-5 py-3">
                    <button onClick={() => deleteExpense(exp.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-auto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No expenses recorded</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card overflow-hidden">
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
              {salaries.length > 0 ? salaries.map((sal) => (
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
      )}

      <Modal isOpen={showInvoiceModal} onClose={() => setShowInvoiceModal(false)} title="New Invoice" size="xl">
        <InvoiceForm
          onSuccess={() => { setShowInvoiceModal(false); fetchData() }}
          clients={clients}
        />
      </Modal>

      <Modal isOpen={showExpenseModal} onClose={() => setShowExpenseModal(false)} title="Add Expense" size="lg">
        <ExpenseForm
          onSuccess={() => { setShowExpenseModal(false); fetchData() }}
          clients={clients}
        />
      </Modal>
    </div>
  )
}
