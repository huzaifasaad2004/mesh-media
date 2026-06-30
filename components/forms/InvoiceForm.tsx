'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Loader2 } from 'lucide-react'
import { DEFAULT_TERMS, DEFAULT_INVOICE_NOTES } from '@/lib/company'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

interface LineItem { description: string; quantity: number; unit_price: number }
interface InvoiceFormProps {
  onSuccess: () => void
  clients: { id: string; company_name: string }[]
  initialData?: Record<string, unknown>
}

const defaultItem = (): LineItem => ({ description: '', quantity: 1, unit_price: 0 })

function getStoredSettings() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('mesh_company_settings') ?? '{}') } catch { return {} }
}

export default function InvoiceForm({ onSuccess, clients, initialData }: InvoiceFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showTerms, setShowTerms] = useState(!!(initialData?.terms))
  const [aiLoading, setAiLoading] = useState<number | null>(null)

  const suggestDescription = async (idx: number) => {
    setAiLoading(idx)
    try {
      const existing = items.filter((_, i) => i !== idx).map(i => i.description).filter(Boolean)
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'description', context: 'invoice for marketing agency services', existing }),
      })
      const data = await res.json()
      if (data.result) setItems(p => p.map((item, i) => i === idx ? { ...item, description: data.result } : item))
    } catch { /* ignore */ } finally { setAiLoading(null) }
  }
  const [form, setForm] = useState({
    invoice_number: (initialData?.invoice_number as string) ?? `MM-INV-${new Date().getFullYear()}-`,
    client_id: (initialData?.client_id as string) ?? '',
    status: (initialData?.status as string) ?? 'draft',
    issue_date: (initialData?.issue_date as string) ?? new Date().toISOString().split('T')[0],
    due_date: (initialData?.due_date as string) ?? '',
    subject: (initialData?.subject as string) ?? '',
    notes: (initialData?.notes as string) ?? '',
    terms: (initialData?.terms as string) ?? '',
  })

  useEffect(() => {
    if (!initialData?.id) {
      const s = getStoredSettings()
      setForm(f => ({
        ...f,
        notes: f.notes || s.default_invoice_notes || DEFAULT_INVOICE_NOTES,
        terms: f.terms || s.default_terms || DEFAULT_TERMS,
      }))
      setShowTerms(true)
    }
  }, [initialData?.id])

  const existingItems = (initialData?.items as any[]) ?? []
  const [items, setItems] = useState<LineItem[]>(
    existingItems.length > 0
      ? existingItems.map((i: any) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) }))
      : [defaultItem()]
  )

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  const setItem = (idx: number, field: keyof LineItem, value: string) =>
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: field === 'description' ? value : parseFloat(value) || 0 } : item))

  const grandTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = {
      ...form,
      due_date: form.due_date || null,
      subject: form.subject || null,
      notes: form.notes || null,
      terms: showTerms ? (form.terms || null) : null,
      items,
    }
    const id = initialData?.id as string | undefined
    const res = await fetch(id ? `/api/invoices/${id}` : '/api/invoices', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Invoice Number</label>
          <input className={inputClass} value={form.invoice_number} onChange={set('invoice_number')} required />
        </div>
        <div>
          <label className={labelClass}>Client *</label>
          <select className={inputClass} value={form.client_id} onChange={set('client_id')} required>
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Issue Date</label>
          <input className={inputClass} type="date" value={form.issue_date} onChange={set('issue_date')} required />
        </div>
        <div>
          <label className={labelClass}>Due Date</label>
          <input className={inputClass} type="date" value={form.due_date} onChange={set('due_date')} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Subject / Project Description</label>
        <input className={inputClass} value={form.subject} onChange={set('subject')} placeholder="e.g. Social media management – June 2025" />
      </div>

      {/* Line Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass + ' mb-0'}>Line Items</label>
          <button type="button" onClick={() => setItems(p => [...p, defaultItem()])} className="btn-ghost btn-sm">
            <Plus className="w-3 h-3" /> Add Line
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 px-1">
            <span className="col-span-5">Description</span>
            <span className="col-span-2">Qty</span>
            <span className="col-span-3">Unit Price (AED)</span>
            <span className="col-span-1 text-right">Total</span>
            <span className="col-span-1" />
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5 relative">
                <input className={inputClass + ' pr-8'} placeholder="Description" value={item.description}
                  onChange={e => setItem(idx, 'description', e.target.value)} required />
                <button type="button" title="AI suggest description"
                  onClick={() => suggestDescription(idx)} disabled={aiLoading === idx}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-purple-400 hover:text-purple-600 disabled:opacity-50 transition-colors">
                  {aiLoading === idx ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                </button>
              </div>
              <input className={inputClass + ' col-span-2'} type="number" min="0.01" step="0.01" value={item.quantity}
                onChange={e => setItem(idx, 'quantity', e.target.value)} />
              <input className={inputClass + ' col-span-3'} type="number" min="0" step="0.01" value={item.unit_price}
                onChange={e => setItem(idx, 'unit_price', e.target.value)} />
              <span className="col-span-1 text-right text-sm font-medium text-gray-700">
                {(item.quantity * item.unit_price).toLocaleString('en-AE', { maximumFractionDigits: 0 })}
              </span>
              <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                className="col-span-1 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-3 mt-2 border-t border-gray-100">
          <div className="text-right">
            <span className="text-sm text-gray-500 mr-4">Grand Total</span>
            <span className="text-xl font-bold text-gray-900">AED {grandTotal.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes <span className="text-gray-400 font-normal">(shown on invoice)</span></label>
        <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
      </div>

      {/* Terms & Conditions toggle */}
      <div>
        <button type="button" onClick={() => setShowTerms(p => !p)}
          className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">
          {showTerms ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          {showTerms ? 'Hide' : 'Include'} Terms & Conditions
        </button>
        {showTerms && (
          <div className="mt-2">
            <textarea className={inputClass} rows={6} value={form.terms} onChange={set('terms')}
              placeholder="Enter terms and conditions..." style={{ fontFamily: 'monospace', fontSize: 12 }} />
            <p className="text-xs text-gray-400 mt-1">These will appear at the bottom of the invoice PDF.</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Invoice' : 'Create Invoice'}
      </button>
    </form>
  )
}
