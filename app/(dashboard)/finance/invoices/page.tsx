'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Eye, Send, ArrowLeft, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import InvoiceForm from '@/components/forms/InvoiceForm'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'

const STATUS_FLOW = ['draft', 'sent', 'paid', 'overdue', 'cancelled']

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    const [invRes, cliRes] = await Promise.all([fetch('/api/invoices'), fetch('/api/clients')])
    const [invData, cliData] = await Promise.all([invRes.json(), cliRes.json()])
    // auto-compute overdue
    const today = new Date().toISOString().split('T')[0]
    const inv = (Array.isArray(invData) ? invData : []).map((i: any) => ({
      ...i,
      status: i.status === 'sent' && i.due_date && i.due_date < today ? 'overdue' : i.status,
    }))
    setInvoices(inv)
    setClients(Array.isArray(cliData) ? cliData : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const updateStatus = async (id: string, status: string) => {
    setStatusDropdown(null)
    await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    fetchData()
  }

  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const openEdit = async (inv: any) => {
    // fetch full invoice with items
    const res = await fetch(`/api/invoices/${inv.id}`)
    const full = await res.json()
    setEditing(full)
    setShowModal(true)
  }

  const totals = {
    paid: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total ?? 0), 0),
    outstanding: invoices.filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + (i.total ?? 0), 0),
    overdue: invoices.filter(i => i.status === 'overdue').length,
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/finance" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Invoices</h1>
            <p className="text-gray-500 text-sm mt-0.5">{invoices.length} total · {formatCurrency(totals.outstanding)} outstanding</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {/* Summary pills */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {[
          { label: 'Paid', value: formatCurrency(totals.paid), color: 'text-green-700 bg-green-50' },
          { label: 'Outstanding', value: formatCurrency(totals.outstanding), color: 'text-orange-700 bg-orange-50' },
          { label: `${totals.overdue} Overdue`, value: '', color: 'text-red-700 bg-red-50' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`px-4 py-2 rounded-lg text-sm font-medium ${color}`}>{label}{value ? ` · ${value}` : ''}</div>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Invoice #</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Subject</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Amount</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Date</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invoices.length > 0 ? invoices.map((inv) => (
                <tr key={inv.id} className="table-row">
                  <td className="px-5 py-3 font-medium text-brand-600">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-gray-700">{inv.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs max-w-[160px] truncate">{inv.subject ?? inv.notes ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold">{formatCurrency(inv.total)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(inv.issue_date)}</td>
                  <td className="px-5 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setStatusDropdown(statusDropdown === inv.id ? null : inv.id)}
                        className={`badge ${statusColor(inv.status)} cursor-pointer flex items-center gap-1`}
                      >
                        {statusLabel(inv.status)} <ChevronDown className="w-3 h-3" />
                      </button>
                      {statusDropdown === inv.id && (
                        <div className="absolute left-0 top-7 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                          {STATUS_FLOW.map(s => (
                            <button key={s} onClick={() => updateStatus(inv.id, s)}
                              className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${inv.status === s ? 'font-semibold text-brand-600' : 'text-gray-700'}`}>
                              {statusLabel(s)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer"
                        className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="View / Print PDF">
                        <Eye className="w-3.5 h-3.5" />
                      </a>
                      {inv.client?.email && (
                        <a href={`mailto:${inv.client.email}?subject=Invoice ${inv.invoice_number} from Mesh Media&body=Please find attached your invoice ${inv.invoice_number} for AED ${inv.total}. View here: ${window?.location?.origin}/invoice/${inv.id}`}
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Send via Email">
                          <Send className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => openEdit(inv)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteInvoice(inv.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-gray-400 text-sm">No invoices yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {statusDropdown && (
        <div className="fixed inset-0 z-10" onClick={() => setStatusDropdown(null)} />
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? `Edit Invoice ${editing.invoice_number}` : 'New Invoice'} size="xl">
        <InvoiceForm
          onSuccess={() => { setShowModal(false); setEditing(null); fetchData() }}
          clients={clients}
          initialData={editing ?? undefined}
        />
      </Modal>
    </div>
  )
}
