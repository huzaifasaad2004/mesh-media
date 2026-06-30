'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import ExpenseForm from '@/components/forms/ExpenseForm'
import { formatCurrency, formatDate } from '@/lib/utils'

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
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const visible = filterCat ? expenses.filter(e => e.category === filterCat) : expenses
  const total = visible.reduce((s, e) => s + (e.amount ?? 0), 0)
  const byCategory = Object.entries(
    expenses.reduce((acc: Record<string, number>, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

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
        <button onClick={() => setFilterCat('')}
          className={`card px-3 py-3 text-center transition-all ${!filterCat ? 'ring-2 ring-brand-600' : 'hover:shadow-sm'}`}>
          <p className="text-sm font-bold text-gray-900">{formatCurrency(expenses.reduce((s, e) => s + (e.amount ?? 0), 0))}</p>
          <p className="text-xs text-gray-500 mt-0.5">All</p>
        </button>
        {byCategory.map(([cat, amt]) => (
          <button key={cat} onClick={() => setFilterCat(filterCat === cat ? '' : cat)}
            className={`card px-3 py-3 text-center transition-all ${filterCat === cat ? 'ring-2 ring-brand-600' : 'hover:shadow-sm'}`}>
            <p className="text-sm font-bold text-gray-900">{formatCurrency(amt)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{CAT_LABELS[cat] ?? cat}</p>
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-700">
            {visible.length} expenses · {formatCurrency(total)}
          </span>
        </div>
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
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
                      {exp.is_recurring && <span title="Recurring"><RefreshCw className="w-3 h-3 text-blue-500 flex-shrink-0" /></span>}
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
                <tr><td colSpan={6} className="px-5 py-16 text-center text-gray-400 text-sm">No expenses{filterCat ? ' in this category' : ' yet'}</td></tr>
              )}
            </tbody>
          </table>
        )}
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
