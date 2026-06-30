'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

interface LineItem { description: string; quantity: number; unit_price: number }
interface QuotationFormProps {
  onSuccess: () => void
  clients: { id: string; company_name: string }[]
  initialData?: Record<string, unknown>
}

const defaultItem = (): LineItem => ({ description: '', quantity: 1, unit_price: 0 })

function addDays(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split('T')[0]
}

export default function QuotationForm({ onSuccess, clients, initialData }: QuotationFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    quote_number: (initialData?.quote_number as string) ?? '',
    client_id: (initialData?.client_id as string) ?? '',
    status: (initialData?.status as string) ?? 'draft',
    issue_date: (initialData?.issue_date as string) ?? new Date().toISOString().split('T')[0],
    expiry_date: (initialData?.expiry_date as string) ?? addDays(7),
    subject: (initialData?.subject as string) ?? '',
    notes: (initialData?.notes as string) ?? 'Looking forward for your business.',
  })
  const existingItems = (initialData?.items as any[]) ?? []
  const [items, setItems] = useState<LineItem[]>(
    existingItems.length > 0
      ? existingItems.map((i: any) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) }))
      : [defaultItem()]
  )

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }))

  const setItem = (idx: number, field: keyof LineItem, value: string) =>
    setItems(p => p.map((item, i) => i === idx ? { ...item, [field]: field === 'description' ? value : parseFloat(value) || 0 } : item))

  const grandTotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_id) { setError('Please select a client'); return }
    setSaving(true); setError('')
    const payload = { ...form, expiry_date: form.expiry_date || null, subject: form.subject || null, notes: form.notes || null, items }
    const id = initialData?.id as string | undefined
    const res = await fetch(id ? `/api/quotations/${id}` : '/api/quotations', {
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
          <label className={labelClass}>Client *</label>
          <select className={inputClass} value={form.client_id} onChange={set('client_id')} required>
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            {['draft','sent','accepted','declined','expired'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Subject / Project Description</label>
        <input className={inputClass} value={form.subject} onChange={set('subject')} placeholder="e.g. Website design and development" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Quote Date</label>
          <input className={inputClass} type="date" value={form.issue_date} onChange={set('issue_date')} required />
        </div>
        <div>
          <label className={labelClass}>Expiry Date</label>
          <input className={inputClass} type="date" value={form.expiry_date} onChange={set('expiry_date')} />
        </div>
      </div>

      {/* Line items */}
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
              <input className={inputClass + ' col-span-5'} placeholder="Description" value={item.description}
                onChange={e => setItem(idx, 'description', e.target.value)} required />
              <input className={inputClass + ' col-span-2'} type="number" min="0.01" step="0.01" value={item.quantity}
                onChange={e => setItem(idx, 'quantity', e.target.value)} />
              <input className={inputClass + ' col-span-3'} type="number" min="0" step="0.01" value={item.unit_price}
                onChange={e => setItem(idx, 'unit_price', e.target.value)} />
              <span className="col-span-1 text-right text-sm font-medium">{(item.quantity * item.unit_price).toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
              <button type="button" onClick={() => setItems(p => p.filter((_, i) => i !== idx))}
                className="col-span-1 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end pt-3 mt-2 border-t border-gray-100">
          <div className="text-right">
            <span className="text-sm text-gray-500 mr-4">Total</span>
            <span className="text-lg font-bold text-gray-900">AED {grandTotal.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <div>
        <label className={labelClass}>Notes (bottom of quote)</label>
        <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Quotation' : 'Create Quotation'}
      </button>
    </form>
  )
}
