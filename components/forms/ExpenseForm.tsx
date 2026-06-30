'use client'

import { useState } from 'react'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'office', label: 'Office & Rent' },
  { value: 'freelancer', label: 'Salaries & Freelancers' },
  { value: 'software', label: 'IT & Software' },
  { value: 'ads', label: 'Advertising & Marketing' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
]

interface ExpenseFormProps {
  onSuccess: () => void
  clients: { id: string; company_name: string }[]
  initialData?: Record<string, unknown>
}

export default function ExpenseForm({ onSuccess, clients, initialData }: ExpenseFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    description: (initialData?.description as string) ?? '',
    category: (initialData?.category as string) ?? 'other',
    amount: (initialData?.amount as number)?.toString() ?? '',
    date: (initialData?.date as string) ?? new Date().toISOString().split('T')[0],
    client_id: (initialData?.client_id as string) ?? '',
  })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      description: form.description,
      category: form.category,
      amount: form.amount ? parseFloat(form.amount) : 0,
      date: form.date,
      client_id: form.client_id || null,
    }
    const id = initialData?.id as string | undefined
    const url = id ? `/api/expenses/${id}` : '/api/expenses'
    const method = id ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Description *</label>
        <input className={inputClass} value={form.description} onChange={set('description')} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Category</label>
          <select className={inputClass} value={form.category} onChange={set('category')}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Amount (AED)</label>
          <input className={inputClass} type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Date</label>
          <input className={inputClass} type="date" value={form.date} onChange={set('date')} required />
        </div>
        <div>
          <label className={labelClass}>Client (optional)</label>
          <select className={inputClass} value={form.client_id} onChange={set('client_id')}>
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Expense' : 'Add Expense'}
      </button>
    </form>
  )
}
