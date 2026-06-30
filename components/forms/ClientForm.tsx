'use client'

import { useState } from 'react'
import type { Client } from '@/types/database'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

interface ClientFormProps {
  onSuccess: () => void
  initialData?: Partial<Client>
}

export default function ClientForm({ onSuccess, initialData }: ClientFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    company_name: initialData?.company_name ?? '',
    industry: initialData?.industry ?? '',
    status: initialData?.status ?? 'lead',
    email: initialData?.email ?? '',
    phone: initialData?.phone ?? '',
    address: initialData?.address ?? '',
    monthly_retainer: initialData?.monthly_retainer?.toString() ?? '',
    currency: (initialData as any)?.currency ?? 'AED',
    contract_start_date: (initialData as any)?.contract_start_date ?? '',
    contract_end_date: (initialData as any)?.contract_end_date ?? '',
    drive_folder_url: initialData?.drive_folder_url ?? '',
    notes: initialData?.notes ?? '',
  })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      monthly_retainer: form.monthly_retainer ? parseFloat(form.monthly_retainer) : null,
      contract_start_date: form.contract_start_date || null,
      contract_end_date: form.contract_end_date || null,
      industry: form.industry || null,
      email: form.email || null,
      phone: form.phone || null,
      address: form.address || null,
      drive_folder_url: form.drive_folder_url || null,
      notes: form.notes || null,
    }
    const url = initialData?.id ? `/api/clients/${initialData.id}` : '/api/clients'
    const method = initialData?.id ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Company Name *</label>
        <input className={inputClass} value={form.company_name} onChange={set('company_name')} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Industry</label>
          <input className={inputClass} value={form.industry} onChange={set('industry')} />
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="lead">Lead</option>
            <option value="onboarding">Onboarding</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Email</label>
          <input className={inputClass} type="email" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input className={inputClass} value={form.phone} onChange={set('phone')} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Address</label>
        <input className={inputClass} value={form.address} onChange={set('address')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Monthly Retainer</label>
          <input className={inputClass} type="number" min="0" step="0.01" value={form.monthly_retainer} onChange={set('monthly_retainer')} />
        </div>
        <div>
          <label className={labelClass}>Currency</label>
          <input className={inputClass} value={form.currency} onChange={set('currency')} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Contract Start Date</label>
          <input className={inputClass} type="date" value={form.contract_start_date} onChange={set('contract_start_date')} />
        </div>
        <div>
          <label className={labelClass}>Contract End Date</label>
          <input className={inputClass} type="date" value={form.contract_end_date} onChange={set('contract_end_date')} />
        </div>
      </div>

      <div>
        <label className={labelClass}>Google Drive Folder URL</label>
        <input className={inputClass} type="url" value={form.drive_folder_url} onChange={set('drive_folder_url')} />
      </div>

      <div>
        <label className={labelClass}>Notes</label>
        <textarea className={inputClass} rows={3} value={form.notes} onChange={set('notes')} />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Client' : 'Create Client'}
      </button>
    </form>
  )
}
