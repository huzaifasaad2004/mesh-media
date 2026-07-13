'use client'

import { useState } from 'react'

const inputClass = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose focus:border-transparent'
const labelClass = 'block text-sm font-medium text-umber-700 mb-1'

export default function ContractorForm({ onSuccess }: { onSuccess: () => void }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', email: '', phone: '', bank_details: '', notes: '' })

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/contractors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Failed'); return }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelClass}>Name *</label>
        <input className={inputClass} value={form.name} onChange={set('name')} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Email</label>
          <input className={inputClass} type="email" value={form.email} onChange={set('email')} placeholder="For their payment link & receipts" />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input className={inputClass} value={form.phone} onChange={set('phone')} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Bank Details</label>
        <textarea className={inputClass} rows={2} value={form.bank_details} onChange={set('bank_details')} placeholder="IBAN, account name, bank — freeform" />
      </div>
      <div>
        <label className={labelClass}>Notes</label>
        <textarea className={inputClass} rows={2} value={form.notes} onChange={set('notes')} />
      </div>
      <p className="text-xs text-taupe-500">
        They&apos;ll be emailed a personal link to track their payments and upload files — no account or password needed.
      </p>
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : 'Add Contractor'}
      </button>
    </form>
  )
}
