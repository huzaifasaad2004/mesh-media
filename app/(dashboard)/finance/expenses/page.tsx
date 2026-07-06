'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, RefreshCw, Search } from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import ExpenseForm from '@/components/forms/ExpenseForm'
import Pagination from '@/components/ui/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

const PAGE_SIZE = 10

const CAT_LABELS: Record<string, string> = {
  office: 'Office & Rent',
  freelancer: 'Salaries & Freelancers',
  software: 'IT & Software',
  ads: 'Advertising',
  travel: 'Travel',
  other: 'Other',
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('')
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const toast = useToast()

  const fetchData = useCallback(async () => {
    const [expRes, cliRes] = await Promise.all([fetch('/api/expenses'), fetch('/api/clients')])
    const [expData, cliData] = await Promise.all([expRes.json(), cliRes.json()])
    setExpenses(Array.isArray(expData) ? expData : [])
    setClients(Array.isArray(cliData) ? cliData : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const deleteExpense = async (id: string) => {
    if (!confirm('Delete this expense?')) return
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Expense deleted'); fetchData() }
    else toast.error('Failed to delete expense')
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return expenses.filter((e) => {
      if (filterCat && e.category !== filterCat) return false
      if (dateFrom && e.date < dateFrom) return false
      if (dateTo && e.date > dateTo) return false
      if (!q) return true
      return (
        e.description?.toLowerCase().includes(q) ||
        e.client?.company_name?.toLowerCase().includes(q)
      )
    })
  }, [expenses, filterCat, query, dateFrom, dateTo])

  const total = filtered.reduce((s, e) => s + (e.amount ?? 0), 0)
  const byCategory = Object.entries(
    expenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/finance" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Expenses</h1>
            <p className="text-gray-500 text-sm mt-0.5">{expenses.length} records · {formatCurrency(expenses.reduce((s, e) => s + (e.amount ?? 0), 0))} total</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {/* Category breakdown */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        <button onClick={() => { setFilterCat(''); setPage(1) }}
          className={`card px-3 py-3 text-center transition-all ${!filterCat ? 'ring-2 ring-brand-600' : 'hover:shadow-sm'}`}>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(expenses.reduce((s, e) => s + (e.amount ?? 0), 0))}</p>
          <p className="text-xs text-gray-500 mt-0.5">All</p>
        </button>
        {byCategory.map(([cat, amt]) => (
          <button key={cat} onClick={() => { setFilterCat(filterCat === cat ? '' : cat); setPage(1) }}
            className={`card px-3 py-3 text-center transition-all ${filterCat === cat ? 'ring-2 ring-brand-600' : 'hover:shadow-sm'}`}>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(amt)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{CAT_LABELS[cat] ?? cat}</p>
          </button>
        ))}
      </div>

      {/* Search + date filter */}
      <div className="card px-4 py-3 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-gray-400"
            placeholder="Search description, client…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600" />
          <span className="text-gray-400 text-xs">to</span>
          <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600" />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">
            {filtered.length} expenses · {formatCurrency(total)}
          </span>
        </div>
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Description</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Category</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.length > 0 ? visible.map((exp) => (
                <tr key={exp.id} className="table-row">
                  <td className="px-5 py-3 text-gray-900">
                    <div className="flex items-center gap-2">
                      {exp.is_recurring && <span title="Recurring"><RefreshCw className="w-3 h-3 text-taupe-500 flex-shrink-0" /></span>}
                      {exp.description}
                    </div>
                  </td>
                  <td className="px-5 py-3"><span className="badge bg-gray-100 text-gray-600">{CAT_LABELS[exp.category] ?? exp.category}</span></td>
                  <td className="px-5 py-3 text-gray-500">{exp.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold text-red-700">−{formatCurrency(exp.amount)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(exp.date)}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditing(exp); setShowModal(true) }}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteExpense(exp.id)}
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyState
                  colSpan={6}
                  title={filterCat || query || dateFrom || dateTo ? 'No expenses match your filters' : 'No expenses yet'}
                  helper={filterCat || query || dateFrom || dateTo ? 'Try clearing your search or category filter.' : 'Track office costs, freelancers, software, and more.'}
                  action={!(filterCat || query || dateFrom || dateTo) ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-3 h-3" /> Add Expense</button> : undefined}
                />
              )}
            </tbody>
          </table></div>
        )}
        <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? 'Edit Expense' : 'Add Expense'} size="lg">
        <ExpenseForm
          onSuccess={() => { setShowModal(false); setEditing(null); fetchData() }}
          clients={clients}
          initialData={editing ?? undefined}
        />
      </Modal>
    </div>
  )
}
