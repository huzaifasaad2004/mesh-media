'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Pencil, Trash2, Eye, Send, ArrowLeft, ChevronDown, Loader2, FileOutput } from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import QuotationForm from '@/components/forms/QuotationForm'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'

const STATUS_FLOW = ['draft', 'sent', 'accepted', 'declined', 'expired']

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null)
  const [sending, setSending] = useState<string | null>(null)
  const toast = useToast()

  const fetchData = useCallback(async () => {
    const [qRes, cRes] = await Promise.all([fetch('/api/quotations'), fetch('/api/clients')])
    const [qData, cData] = await Promise.all([qRes.json(), cRes.json()])
    setQuotes(Array.isArray(qData) ? qData : [])
    setClients(Array.isArray(cData) ? cData : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const updateStatus = async (id: string, status: string) => {
    setStatusDropdown(null)
    const res = await fetch(`/api/quotations/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    if (!res.ok) {
      const d = await res.json()
      toast.error(`Status update failed: ${d.error ?? 'Unknown error'}`)
    } else {
      toast.success(`Marked as ${statusLabel(status)}`)
    }
    fetchData()
  }

  const sendEmail = async (id: string) => {
    setSending(id)
    const res = await fetch(`/api/quotations/${id}/send`, { method: 'POST' })
    const d = await res.json()
    setSending(null)
    if (res.ok) { toast.success(`Sent to ${d.to}`); fetchData() }
    else toast.error(d.error ?? 'Send failed')
  }

  const convertToInvoice = async (id: string) => {
    if (!confirm('Create an invoice from this accepted quotation?')) return
    setSending(id)
    const res = await fetch(`/api/quotations/${id}/convert`, { method: 'POST' })
    const d = await res.json()
    setSending(null)
    if (res.ok) { toast.success(`Created invoice ${d.invoice_number}`); fetchData() }
    else toast.error(d.error ?? 'Convert failed')
  }

  const deleteQuote = async (id: string) => {
    if (!confirm('Delete this quotation?')) return
    const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Quotation deleted'); fetchData() }
    else toast.error('Failed to delete quotation')
  }

  const openEdit = async (q: any) => {
    const res = await fetch(`/api/quotations/${q.id}`)
    const full = await res.json()
    setEditing(full)
    setShowModal(true)
  }

  const acceptedValue = quotes.filter(q => q.status === 'accepted').reduce((s, q) => s + (q.total ?? 0), 0)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/finance" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Quotations</h1>
            <p className="text-gray-500 text-sm mt-0.5">{quotes.length} total · {formatCurrency(acceptedValue)} accepted</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" /> New Quote
        </button>
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        {['draft', 'sent', 'accepted', 'declined', 'expired'].map(s => {
          const count = quotes.filter(q => q.status === s).length
          return (
            <div key={s} className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${statusColor(s)}`}>
              {statusLabel(s)}: {count}
            </div>
          )
        })}
      </div>

      {loading ? (
        <div className="card px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
      ) : quotes.length > 0 ? (
        <>
          {/* Mobile: stacked cards (avoids clipping the status dropdown that a
              horizontally-scrolling table would cause) */}
          <div className="md:hidden space-y-3">
            {quotes.map((q) => (
              <div key={q.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-brand-600 truncate">{q.quote_number}</p>
                    <p className="text-sm text-gray-700 truncate">{q.client?.company_name ?? '—'}</p>
                  </div>
                  <span className="font-semibold flex-shrink-0">{formatCurrency(q.total)}</span>
                </div>
                {q.subject && <p className="text-xs text-gray-500 mt-1.5 truncate">{q.subject}</p>}
                {q.status === 'declined' && q.decline_reason && (
                  <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>Reason: {q.decline_reason}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <div className="relative inline-block">
                    <button
                      onClick={(e) => { e.stopPropagation(); setStatusDropdown(statusDropdown === q.id ? null : q.id) }}
                      className={`badge ${statusColor(q.status)} cursor-pointer flex items-center gap-1`}
                      style={{ minHeight: 32 }}
                      title={q.status === 'declined' && q.decline_reason ? q.decline_reason : undefined}
                    >
                      {statusLabel(q.status)} <ChevronDown className="w-3 h-3" />
                    </button>
                    {statusDropdown === q.id && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={() => setStatusDropdown(null)} />
                        <div className="absolute left-0 top-9 z-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                          {STATUS_FLOW.map(s => (
                            <button key={s} onClick={(e) => { e.stopPropagation(); updateStatus(q.id, s) }}
                              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 ${q.status === s ? 'font-semibold text-brand-600' : 'text-gray-700'}`}>
                              {statusLabel(s)}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{formatDate(q.issue_date)}{q.expiry_date ? ` → ${formatDate(q.expiry_date)}` : ''}</span>
                </div>
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-gray-100">
                  <a href={`/quotation/${q.id}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors" style={{ minHeight: 40 }} title="View / Print PDF">
                    <Eye className="w-4 h-4" />
                  </a>
                  {q.client?.email && (
                    <button onClick={() => sendEmail(q.id)} disabled={sending === q.id}
                      className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50" style={{ minHeight: 40 }} title="Send via Email">
                      {sending === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  )}
                  {q.status === 'accepted' && !q.converted_invoice_id && (
                    <button onClick={() => convertToInvoice(q.id)} disabled={sending === q.id}
                      className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50" style={{ minHeight: 40 }} title="Convert to invoice">
                      {sending === q.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileOutput className="w-4 h-4" />}
                    </button>
                  )}
                  {q.converted_invoice_id && (
                    <a href={`/invoice/${q.converted_invoice_id}`} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center rounded text-green-600 hover:bg-green-50 transition-colors" style={{ minHeight: 40 }} title="View converted invoice">
                      <FileOutput className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={() => openEdit(q)} className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-brand-600 hover:bg-brand-50 transition-colors" style={{ minHeight: 40 }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteQuote(q.id)} className="flex-1 flex items-center justify-center rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors" style={{ minHeight: 40 }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / tablet: full table */}
          <div className="card overflow-visible hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Quote #</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Subject</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Total</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Issued</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Expires</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {quotes.map((q) => (
                  <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-medium text-brand-600">{q.quote_number}</td>
                    <td className="px-5 py-3 text-gray-700">{q.client?.company_name ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs max-w-[160px] truncate">{q.subject ?? '—'}</td>
                    <td className="px-5 py-3 font-semibold">{formatCurrency(q.total)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(q.issue_date)}</td>
                    <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(q.expiry_date)}</td>
                    <td className="px-5 py-3">
                      <div className="relative inline-block">
                        <button
                          onClick={(e) => { e.stopPropagation(); setStatusDropdown(statusDropdown === q.id ? null : q.id) }}
                          className={`badge ${statusColor(q.status)} cursor-pointer flex items-center gap-1`}
                          title={q.status === 'declined' && q.decline_reason ? `Reason: ${q.decline_reason}` : undefined}
                        >
                          {statusLabel(q.status)} <ChevronDown className="w-3 h-3" />
                        </button>
                        {statusDropdown === q.id && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setStatusDropdown(null)} />
                            <div className="absolute left-0 top-7 z-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                              {STATUS_FLOW.map(s => (
                                <button key={s} onClick={(e) => { e.stopPropagation(); updateStatus(q.id, s) }}
                                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${q.status === s ? 'font-semibold text-brand-600' : 'text-gray-700'}`}>
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
                        <a href={`/quotation/${q.id}`} target="_blank" rel="noopener noreferrer"
                          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors" title="View / Print PDF">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                        {q.client?.email && (
                          <button onClick={() => sendEmail(q.id)} disabled={sending === q.id}
                            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors disabled:opacity-50" title="Send via Email">
                            {sending === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {q.status === 'accepted' && !q.converted_invoice_id && (
                          <button onClick={() => convertToInvoice(q.id)} disabled={sending === q.id}
                            className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50" title="Convert to invoice">
                            {sending === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileOutput className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        {q.converted_invoice_id && (
                          <a href={`/invoice/${q.converted_invoice_id}`} target="_blank" rel="noopener noreferrer"
                            className="w-7 h-7 flex items-center justify-center rounded text-green-600 hover:bg-green-50 transition-colors" title="View converted invoice">
                            <FileOutput className="w-3.5 h-3.5" />
                          </a>
                        )}
                        <button onClick={() => openEdit(q)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteQuote(q.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="card">
          <EmptyState
            title="No quotations yet"
            helper="Create your first quotation to send to a client for approval."
            action={<button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-3 h-3" /> New Quote</button>}
          />
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? `Edit Quote ${editing.quote_number}` : 'New Quotation'} size="xl">
        <QuotationForm
          onSuccess={() => { setShowModal(false); setEditing(null); fetchData() }}
          clients={clients}
          initialData={editing ?? undefined}
        />
      </Modal>
    </div>
  )
}
