'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Eye, Send, ArrowLeft, ChevronDown, Loader2, CheckCircle } from 'lucide-react'
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
  const [sending, setSending] = useState<string | null>(null)
  const [sendMsg, setSendMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null)

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

  const sendEmail = async (id: string) => {
    setSending(id); setSendMsg(null)
    const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
    const d = await res.json()
    setSending(null)
    setSendMsg({ id, msg: res.ok ? `Sent to ${d.to}` : (d.error ?? 'Send failed'), ok: res.ok })
    if (res.ok) fetchData()
    setTimeout(() => setSendMsg(null), 4000)
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

      {sendMsg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${sendMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {sendMsg.ok && <CheckCircle className="w-4 h-4" />}
          {sendMsg.msg}
        </div>
      )}

      <div className="card overflow-visible">
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
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-brand-600">{inv.invoice_number}</td>
                  <td className="px-5 py-3 text-gray-700">{inv.client?.company_name ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500 text-xs max-w-[160px] truncate">{inv.subject ?? inv.notes ?? '—'}</td>
                  <td className="px-5 py-3 font-semibold">{formatCurrency(inv.total)}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(inv.issue_date)}</td>
                  <td className="px-5 py-3">
                    <div className="relative inline-block">
                      <button
                        onClick={(e) => { e.stopPropagation(); setStatusDropdown(statusDropdown === inv.id ? null : inv.id) }}
                        className={`badge ${statusColor(inv.status)} cursor-pointer flex items-center gap-1`}
                      >
                        {statusLabel(inv.status)} <ChevronDown className="w-3 h-3" />
                      </button>
                      {statusDropdown === inv.id && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setStatusDropdown(null)} />
                          <div className="absolute left-0 top-7 z-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                            {STATUS_FLOW.map(s => (
                              <button key={s} onClick={(e) => { e.stopPropagation(); updateStatus(inv.id, s) }}
                                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${inv.status === s ? 'font-semibold text-brand-600' : 'text-gray-700'}`}>
                                {statusLabel(s)}
                              </button>
                            ))}
                          </div>
                        </>
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
                        <button onClick={() => sendEmail(inv.id)} disabled={sending === inv.id}
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50" title="Send via Email (Resend)">
                          {sending === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
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
