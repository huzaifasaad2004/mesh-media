'use client'

import { useEffect, useState } from 'react'

const inputClass = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose focus:border-transparent'
const labelClass = 'block text-sm font-medium text-umber-700 mb-1'

const CURRENCIES = ['AED', 'PKR', 'USD', 'GBP', 'INR']

export default function SalaryForm({ onSuccess, initialData }: { onSuccess: () => void; initialData?: Record<string, any> }) {
  const [members, setMembers] = useState<{ id: string; full_name: string | null; email: string | null }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    profile_id: initialData?.profile_id ?? '', amount: initialData?.amount?.toString() ?? '', currency: initialData?.currency ?? 'AED', pay_period: initialData?.pay_period ?? 'monthly',
    effective_from: initialData?.effective_from ?? new Date().toISOString().split('T')[0], notes: initialData?.notes ?? '',
  })

  useEffect(() => {
    fetch('/api/profiles').then(r => r.json()).then(d => setMembers(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch(initialData?.id ? `/api/salaries/${initialData.id}` : '/api/salaries', {
      method: initialData?.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Failed'); return }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelClass}>Team Member *</label>
        <select className={inputClass} value={form.profile_id} onChange={set('profile_id')} required disabled={!!initialData?.id}>
          <option value="">Select…</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Amount *</label>
          <input className={inputClass} type="number" min="0" step="0.01" value={form.amount} onChange={set('amount')} required />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <select className={inputClass} value={form.currency} onChange={set('currency')}>
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Pay Period</label>
          <select className={inputClass} value={form.pay_period} onChange={set('pay_period')}>
            <option value="monthly">Monthly</option>
            <option value="bi-weekly">Bi-weekly</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Start Date *</label>
          <input className={inputClass} type="date" value={form.effective_from} onChange={set('effective_from')} required />
        </div>
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
      </div>
      {form.pay_period === 'monthly' && (
        <p className="text-xs text-taupe-500">
          Monthly salaries are auto-generated each month via &quot;Run This Month&apos;s Payroll&quot; — no need to re-enter every month.
        </p>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Salary' : 'Set Salary'}
      </button>
    </form>
  )
}
