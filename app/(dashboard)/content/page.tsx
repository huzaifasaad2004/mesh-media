'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Check, X, ExternalLink, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const STATUS_LABEL: Record<string, string> = {
  pending_manager: 'Pending your manager',
  manager_rejected: 'Sent back for changes',
  pending_client: 'Awaiting client review',
  client_approved: 'Approved by client',
  client_declined: 'Declined by client',
}
const STATUS_COLOR: Record<string, string> = {
  pending_manager: 'bg-yellow-100 text-yellow-700',
  manager_rejected: 'bg-red-100 text-red-700',
  pending_client: 'bg-blue-100 text-blue-700',
  client_approved: 'bg-green-100 text-green-700',
  client_declined: 'bg-red-100 text-red-700',
}

function SubmitForm({ clients, onSuccess }: { clients: { id: string; company_name: string }[]; onSuccess: () => void }) {
  const [form, setForm] = useState({ client_id: '', title: '', description: '', file_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/content-items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
    onSuccess()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelClass}>Client *</label>
        <select className={inputClass} value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} required>
          <option value="">Select a client</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.company_name}</option>)}
        </select>
      </div>
      <div>
        <label className={labelClass}>Title *</label>
        <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea className={inputClass} rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </div>
      <div>
        <label className={labelClass}>Link to the content (Drive, etc.)</label>
        <input className={inputClass} type="url" placeholder="https://…" value={form.file_url} onChange={e => setForm(f => ({ ...f, file_url: e.target.value }))} />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
        {saving ? 'Submitting…' : 'Submit for review'}
      </button>
    </form>
  )
}

export default function ContentPage() {
  const [items, setItems] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const toast = useToast()

  const load = useCallback(async () => {
    const [iRes, cRes, meRes] = await Promise.all([
      fetch('/api/content-items'), fetch('/api/clients'), fetch('/api/profiles/me'),
    ])
    const [i, c, me] = await Promise.all([iRes.json(), cRes.json(), meRes.json()])
    setItems(Array.isArray(i) ? i : [])
    setClients(Array.isArray(c) ? c : [])
    setCanManage(['owner', 'admin', 'manager'].includes(me?.role))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const decide = async (id: string, decision: 'forward' | 'reject') => {
    const res = await fetch(`/api/content-items/${id}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, comment }),
    })
    const d = await res.json()
    if (res.ok) toast.success(decision === 'forward' ? 'Forwarded to client' : 'Sent back for changes')
    else toast.error(d.error ?? 'Failed')
    setReviewing(null); setComment(''); load()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Content Approvals</h1>
          <p className="text-taupe-600 text-sm mt-0.5">Submit content for manager review, then client sign-off.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Submit Content
        </button>
      </div>

      {loading ? (
        <div className="card h-40 animate-pulse bg-paper-100" />
      ) : items.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="divide-y divide-paper-200">
            {items.map(item => (
              <div key={item.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-taupe-500 mt-0.5">
                      {item.client?.company_name} · by {item.creator?.full_name ?? 'someone'} · {formatDate(item.created_at)}
                    </p>
                    {item.description && <p className="text-sm text-taupe-600 mt-1.5">{item.description}</p>}
                    {item.client_comment && (item.status === 'client_declined') && (
                      <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>Client: {item.client_comment}</p>
                    )}
                    {item.manager_comment && item.status === 'manager_rejected' && (
                      <p className="text-xs mt-1.5 text-taupe-600">Manager: {item.manager_comment}</p>
                    )}
                    {item.file_url && (
                      <a href={item.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline inline-flex items-center gap-1 mt-1.5">
                        <ExternalLink className="w-3 h-3" /> View content
                      </a>
                    )}
                  </div>
                  <span className={`badge ${STATUS_COLOR[item.status]} flex-shrink-0`}>{STATUS_LABEL[item.status]}</span>
                </div>

                {canManage && item.status === 'pending_manager' && (
                  reviewing === item.id ? (
                    <div className="mt-3 bg-paper-50 border border-sand-300 rounded-lg p-3 space-y-2">
                      <textarea className={inputClass} rows={2} placeholder="Optional comment"
                        value={comment} onChange={e => setComment(e.target.value)} style={{ fontSize: 13 }} />
                      <div className="flex gap-2">
                        <button onClick={() => decide(item.id, 'forward')} className="btn-primary btn-sm flex-1 justify-center">
                          <Check className="w-3 h-3" /> Forward to client
                        </button>
                        <button onClick={() => decide(item.id, 'reject')} className="btn-secondary btn-sm flex-1 justify-center">
                          <X className="w-3 h-3" /> Send back
                        </button>
                        <button onClick={() => { setReviewing(null); setComment('') }} className="btn-ghost btn-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setReviewing(item.id)} className="btn-secondary btn-sm mt-3">Review</button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card">
          <EmptyState
            title="No content submitted yet"
            helper="Submit content for your manager to review and forward to the client."
            action={<button className="btn-primary btn-sm inline-flex" onClick={() => setShowModal(true)}><Plus className="w-3 h-3" /> Submit Content</button>}
          />
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Submit Content">
        <SubmitForm clients={clients} onSuccess={() => { setShowModal(false); load() }} />
      </Modal>
    </div>
  )
}
