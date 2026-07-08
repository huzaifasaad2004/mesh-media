'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Pencil, Trash2, ListChecks, GripVertical } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

interface StepDraft { title: string; description: string }
interface Template {
  id: string
  name: string
  description: string | null
  steps: { id: string; title: string; description: string | null; sort_order: number }[]
}

function TemplateForm({ initialData, onSuccess }: { initialData?: Template; onSuccess: () => void }) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [steps, setSteps] = useState<StepDraft[]>(
    initialData?.steps?.length ? initialData.steps.map((s) => ({ title: s.title, description: s.description ?? '' })) : [{ title: '', description: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const toast = useToast()

  const setStep = (idx: number, field: keyof StepDraft, value: string) =>
    setSteps((p) => p.map((s, i) => (i === idx ? { ...s, [field]: value } : s)))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validSteps = steps.filter((s) => s.title.trim() !== '')
    if (validSteps.length === 0) { setError('Add at least one step'); return }
    setSaving(true); setError('')
    const url = initialData ? `/api/onboarding/templates/${initialData.id}` : '/api/onboarding/templates'
    const res = await fetch(url, {
      method: initialData ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || null, steps: validSteps }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    toast.success(initialData ? 'Template updated' : 'Template created')
    onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className={labelClass}>Template Name *</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Client Onboarding" required />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelClass + ' mb-0'}>Steps</label>
          <button type="button" onClick={() => setSteps((p) => [...p, { title: '', description: '' }])} className="btn-ghost btn-sm">
            <Plus className="w-3 h-3" /> Add Step
          </button>
        </div>
        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <GripVertical className="w-4 h-4 text-gray-300 mt-2.5 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <input className={inputClass} placeholder={`Step ${idx + 1} title`} value={step.title}
                  onChange={(e) => setStep(idx, 'title', e.target.value)} />
                <input className={inputClass + ' text-xs'} placeholder="Optional description" value={step.description}
                  onChange={(e) => setStep(idx, 'description', e.target.value)} />
              </div>
              <button type="button" onClick={() => setSteps((p) => p.filter((_, i) => i !== idx))}
                className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0 mt-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Saving…' : initialData ? 'Update Template' : 'Create Template'}
      </button>
    </form>
  )
}

export default function OnboardingTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Template | null>(null)
  const toast = useToast()

  const fetchData = useCallback(async () => {
    const res = await fetch('/api/onboarding/templates')
    const data = await res.json()
    setTemplates(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const deleteTemplate = async (id: string) => {
    if (!confirm('Delete this template? Onboarding runs already started from it are unaffected.')) return
    const res = await fetch(`/api/onboarding/templates/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Template deleted'); fetchData() }
    else toast.error('Failed to delete template')
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Onboarding Templates</h1>
            <p className="text-gray-500 text-sm mt-0.5">Reusable checklists — start a run from any of these on a client's page</p>
          </div>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {loading ? (
        <div className="card px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
      ) : templates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div key={t.id} className="card p-5">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold text-gray-900">{t.name}</h3>
                  {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => { setEditing(t); setShowModal(true) }} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteTemplate(t.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-2">{t.steps.length} step{t.steps.length === 1 ? '' : 's'}</p>
              <ol className="space-y-1">
                {t.steps.slice(0, 4).map((s) => (
                  <li key={s.id} className="text-sm text-gray-700 flex items-start gap-1.5">
                    <span className="text-gray-300">•</span> {s.title}
                  </li>
                ))}
                {t.steps.length > 4 && <li className="text-xs text-gray-400">+{t.steps.length - 4} more</li>}
              </ol>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={ListChecks}
            title="No onboarding templates yet"
            helper="Create a checklist once, then reuse it for every new client's onboarding run."
            action={<button className="btn-primary btn-sm inline-flex" onClick={() => { setEditing(null); setShowModal(true) }}><Plus className="w-3 h-3" /> New Template</button>}
          />
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditing(null) }} title={editing ? `Edit ${editing.name}` : 'New Onboarding Template'} size="lg">
        <TemplateForm key={editing?.id ?? 'new'} initialData={editing ?? undefined} onSuccess={() => { setShowModal(false); setEditing(null); fetchData() }} />
      </Modal>
    </div>
  )
}
