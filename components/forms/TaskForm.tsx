'use client'

import { useState, useEffect } from 'react'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

interface TaskFormProps {
  onSuccess: () => void
  clients: { id: string; company_name: string }[]
  profiles: { id: string; full_name: string | null; email: string | null }[]
  initialData?: Record<string, unknown>
  /** Members may only change the status of a task already assigned to them. */
  statusOnly?: boolean
}

export default function TaskForm({ onSuccess, clients, profiles, initialData, statusOnly }: TaskFormProps) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string; client_id: string | null }[]>([])
  const [form, setForm] = useState({
    title: (initialData?.title as string) ?? '',
    description: (initialData?.description as string) ?? '',
    client_id: (initialData?.client_id as string) ?? '',
    project_id: (initialData?.project_id as string) ?? '',
    assigned_to: (initialData?.assigned_to as string) ?? '',
    priority: (initialData?.priority as string) ?? 'medium',
    status: (initialData?.status as string) ?? 'todo',
    due_date: (initialData?.due_date as string) ?? '',
  })

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => setProjects(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    const payload = {
      ...form,
      client_id: form.client_id || null,
      project_id: form.project_id || null,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      description: form.description || null,
    }
    const id = initialData?.id as string | undefined
    const url = id ? `/api/tasks/${id}` : '/api/tasks'
    const method = id ? 'PUT' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(statusOnly ? { status: form.status } : payload) })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  if (statusOnly) {
    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900">{form.title}</p>
          {form.description && <p className="text-sm text-gray-500 mt-1 whitespace-pre-wrap">{form.description}</p>}
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
          {saving ? 'Saving…' : 'Update Status'}
        </button>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Title *</label>
        <input className={inputClass} value={form.title} onChange={set('title')} required />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} rows={3} value={form.description} onChange={set('description')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Client</label>
          <select className={inputClass} value={form.client_id} onChange={set('client_id')}>
            <option value="">None</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Project</label>
          <select className={inputClass} value={form.project_id} onChange={set('project_id')}>
            <option value="">None</option>
            {(form.client_id ? projects.filter(p => !p.client_id || p.client_id === form.client_id) : projects).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Assigned To</label>
          <select className={inputClass} value={form.assigned_to} onChange={set('assigned_to')}>
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name ?? p.email}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Priority</label>
          <select className={inputClass} value={form.priority} onChange={set('priority')}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Status</label>
          <select className={inputClass} value={form.status} onChange={set('status')}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Due Date</label>
          <input className={inputClass} type="date" value={form.due_date} onChange={set('due_date')} />
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData?.id ? 'Update Task' : 'Create Task'}
      </button>
    </form>
  )
}
