'use client'

import { useState } from 'react'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

interface ContractFormProps {
  onSuccess: () => void
  clients: { id: string; company_name: string }[]
  documents: { id: string; title: string; status: string; client_id: string | null }[]
  initialData?: Record<string, unknown>
}

export default function ContractForm({ onSuccess, clients, documents, initialData }: ContractFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    title: (initialData?.title as string) ?? '',
    client_id: (initialData?.client_id as string) ?? '',
    status: (initialData?.status as string) ?? 'draft',
    value: (initialData?.value as number)?.toString() ?? '',
    start_date: (initialData?.start_date as string) ?? '',
    end_date: (initialData?.end_date as string) ?? '',
    content: (initialData?.content as string) ?? '',
    signable_document_id: (initialData?.signable_document_id as string) ?? '',
  })

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      value: form.value ? parseFloat(form.value) : null,
      client_id: form.client_id || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      content: form.content || null,
      signable_document_id: form.signable_document_id || null,
    }
    const id = initialData?.id as string | undefined
    const url = id ? `/api/contracts/${id}` : '/api/contracts'
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
        <label className={labelClass}>Title *</label>
        <input className={inputClass} value={form.title} onChange={set('title')} required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Client</label>
          <select className={inputClass} value={form.client_id} onChange={set('client_id')}>
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="signed">Signed</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Value <span className="text-gray-400 font-normal">(AED)</span></label>
        <input className={inputClass} type="number" min="0" step="0.01" value={form.value} onChange={set('value')} placeholder="0.00" />
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
        <label className={labelClass}>Content <span className="text-gray-400 font-normal">(terms, scope, clauses)</span></label>
        <textarea className={inputClass} rows={6} value={form.content} onChange={set('content')} />
      </div>

      <div>
        <label className={labelClass}>Signed / signable document</label>
        <select className={inputClass} value={form.signable_document_id} onChange={set('signable_document_id')}>
          <option value="">Not linked yet</option>
          {documents.filter(document => !form.client_id || !document.client_id || document.client_id === form.client_id).map(document => (
            <option key={document.id} value={document.id}>{document.title} · {document.status.replace('_', ' ')}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">Upload and sign the legal PDF in Documents, then link it here for lifecycle and value tracking.</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Contract' : 'Create Contract'}
      </button>
    </form>
  )
}
