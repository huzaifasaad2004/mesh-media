'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Plus, Pencil, Trash2, Eye, Send, ArrowLeft, ChevronDown, Loader2, Search, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import InvoiceForm from '@/components/forms/InvoiceForm'
import Pagination from '@/components/ui/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'

const STATUS_FLOW = ['draft', 'sent', 'paid', 'overdue', 'cancelled']
const PAGE_SIZE = 10

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [runningRetainers, setRunningRetainers] = useState(false)
  const toast = useToast()

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
    const res = await fetch(`/api/invoices/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (res.ok) { toast.success(`Marked as ${statusLabel(status)}`); fetchData() }
    else toast.error('Failed to update status')
  }

  const sendEmail = async (id: string) => {
    setSending(id)
    const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
    const d = await res.json()
    setSending(null)
    if (res.ok) { toast.success(`Sent to ${d.to}`); fetchData() }
    else toast.error(d.error ?? 'Send failed')
  }

  const deleteInvoice = async (id: string) => {
    if (!confirm('Delete this invoice?')) return
    const res = await fetch(`/api/invoices/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Invoice deleted'); fetchData() }
    else toast.error('Failed to delete invoice')
  }

  const runRetainerInvoices = async () => {
    if (!confirm("Generate this month's retainer invoices for every client with auto-invoicing enabled?")) return
    setRunningRetainers(true)
    const res = await fetch('/api/cron/recurring-invoices', { method: 'POST' })
    const d = await res.json()
    setRunningRetainers(false)
    if (res.ok) { toast.success(`Generated ${d.generated.length} invoice(s)${d.skipped.length ? `, ${d.skipped.length} skipped` : ''}`); fetchData() }
    else toast.error(d.error ?? 'Failed')
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return invoices.filter((inv) => {
      if (dateFrom && inv.issue_date < dateFrom) return false
      if (dateTo && inv.issue_date > dateTo) return false
      if (!q) return true
      return (
        inv.invoice_number?.toLowerCase().includes(q) ||
        inv.client?.company_name?.toLowerCase().includes(q) ||
        inv.subject?.toLowerCase().includes(q)
      )
    })
  }, [invoices, query, dateFrom, dateTo])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

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
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={runRetainerInvoices} disabled={runningRetainers} title="Generate this month's retainer invoices for opted-in clients">
            {runningRetainers ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Run Retainer Invoices
          </button>
          <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
            <Plus className="w-4 h-4" /> New Invoice
          </button>
        </div>
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


      {/* Search + date filter */}
      <div className="card px-4 py-3 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-gray-400"
            placeholder="Search invoice #, client, subject…"
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

      {loading ? (
        <div className="card px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
      ) : filtered.length > 0 ? (
        <>
          {/* Mobile: stacked cards (avoids clipping the status dropdown that a
              horizontally-scrolling table would cause) */}
          <div className="md:hidden space-y-3">
            {visible.map((inv) => (
              <div key={inv.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-600 truncate">{inv.invoice_number}</p>
                    <p className="text-sm text-gray-700 truncate">{inv.client?.company_name ?? '—'}</p>
                  </div>
                  <span className="font-semibold flex-shrink-0">{formatCurrency(inv.total)}</span>
                </div>
                {(inv.subject ?? inv.notes) && <p className="text-xs text-gray-500 mt-1.5 truncate">{inv.subject ?? inv.notes}</p>}
                <div className="flex items-center justify-between mt-3">
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => { e.stopPropagation(); setStatusDropdown(statusDropdown === inv.id ? null : inv.id) }}
                      className={`badge ${statusColor(inv.status)} cursor-pointer flex items-center gap-1`}
                      style={{ minHeight: 32 }}
                    >
                      {statusLabel(inv.status)} <ChevronDown className="w-3 h-3" />
                    </button>
                    {statusDropdown === inv.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setStatusDropdown(null)} />
                        <div className="absolute left-0 top-9 z-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                          {STATUS_FLOW.map(s => (
                            <button key={s} onClick={(e) => { e.stopPropagation(); updateStatus(inv.id, s) }}
                              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 ${inv.status === s ? 'font-semibold text-brand-600' : 'text-gray-700'}`}>
                              {statusLabel(s)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(inv.issue_date)}</span>
                </div>
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                  <a href={`/invoice/${inv.id}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors" style={{ minHeight: 40 }} title="View / Print PDF">
                    <Eye className="w-4 h-4" />
                  </a>
                  {inv.client?.email && (
                    <button onClick={() => sendEmail(inv.id)} disabled={sending === inv.id}
                      className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50" style={{ minHeight: 40 }} title="Send via Email">
                      {sending === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  )}
                  <button onClick={() => openEdit(inv)} className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors" style={{ minHeight: 40 }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteInvoice(inv.id)} className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" style={{ minHeight: 40 }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <div className="card">
              <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </div>
          </div>

          {/* Desktop / tablet: full table */}
          <div className="card overflow-visible hidden md:block">
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
                {visible.map((inv) => (
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
                        {inv.status === 'overdue' && inv.dunning_stage > 0 && (
                          <span className="ml-1.5 text-[10px] text-gray-400" title="Automated reminder stage sent so far">Reminder {inv.dunning_stage}/3</span>
                        )}
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
                            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50" title="Send via Email (Resend)">
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
                ))}
              </tbody>
            </table>
            <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            title={invoices.length === 0 ? 'No invoices yet' : 'No invoices match your search'}
            helper={invoices.length === 0 ? 'Create your first invoice to start billing clients.' : 'Try a different search term or clear your filters.'}
            action={invoices.length === 0 ? <button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-3 h-3" /> New Invoice</button> : undefined}
          />
        </div>
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
