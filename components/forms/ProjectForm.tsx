'use client'

import { useState } from 'react'

const inputClass = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose focus:border-transparent'
const labelClass = 'block text-sm font-medium text-umber-700 mb-1'

interface ProjectFormProps {
  onSuccess: () => void
  clients: { id: string; company_name: string }[]
  initialData?: Record<string, unknown>
}

export default function ProjectForm({ onSuccess, clients, initialData }: ProjectFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: (initialData?.name as string) ?? '',
    client_id: (initialData?.client_id as string) ?? '',
    status: (initialData?.status as string) ?? 'active',
    description: (initialData?.description as string) ?? '',
    start_date: (initialData?.start_date as string) ?? new Date().toISOString().split('T')[0],
    end_date: (initialData?.end_date as string) ?? '',
  })

  const set = (f: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [f]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const payload = {
      ...form,
      client_id: form.client_id || null,
      description: form.description || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    const id = initialData?.id as string | undefined
    const res = await fetch(id ? `/api/projects/${id}` : '/api/projects', {
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
      <div>
        <label className={labelClass}>Project Name *</label>
        <input className={inputClass} value={form.name} onChange={set('name')} required placeholder="e.g. Website redesign" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Client</label>
          <select className={inputClass} value={form.client_id} onChange={set('client_id')}>
            <option value="">No client (internal)</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            {['active', 'paused', 'completed', 'cancelled'].map(s =>
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Start Date</label>
          <input className={inputClass} type="date" value={form.start_date} onChange={set('start_date')} />
        </div>
        <div>
          <label className={labelClass}>End Date</label>
          <input className={inputClass} type="date" value={form.end_date} onChange={set('end_date')} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} rows={3} value={form.description} onChange={set('description')} placeholder="Scope, goals, deliverables…" />
      </div>
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Project' : 'Create Project'}
      </button>
    </form>
  )
}
