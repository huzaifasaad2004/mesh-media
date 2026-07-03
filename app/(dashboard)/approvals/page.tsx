'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Check, X, Loader2, CalendarDays, Receipt, FileQuestion } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { formatDate, formatCurrency } from '@/lib/utils'

const inputClass = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose focus:border-transparent'
const labelClass = 'block text-sm font-medium text-umber-700 mb-1'

const typeMeta: Record<string, { label: string; icon: any }> = {
  time_off: { label: 'Time off', icon: CalendarDays },
  expense:  { label: 'Expense', icon: Receipt },
  other:    { label: 'Other', icon: FileQuestion },
}
const statusStyle: Record<string, string> = {
  pending:  'bg-[#F6ECD6] text-[#8a6116]',
  approved: 'bg-[#E7EFE3] text-[#3F5B3A]',
  rejected: 'bg-[#F4E0DC] text-[#8A2D22]',
}

export default function ApprovalsPage() {
  const [items, setItems] = useState<any[]>([])
  const [canDecide, setCanDecide] = useState(false)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')

  const [form, setForm] = useState({ type: 'time_off', title: '', details: '', amount: '', start_date: '', end_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [aRes, meRes] = await Promise.all([fetch('/api/approvals'), fetch('/api/profiles/me')])
    const a = await aRes.json()
    setItems(Array.isArray(a) ? a : [])
    try {
      const me = await meRes.json()
      setCanDecide(['owner', 'admin', 'manager'].includes(me?.role))
    } catch { /* stays false */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/approvals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Failed'); return }
    setOpen(false)
    setForm({ type: 'time_off', title: '', details: '', amount: '', start_date: '', end_date: '' })
    load()
  }

  const decide = async (id: string, decision: 'approve' | 'reject') => {
    setBusy(id)
    await fetch(`/api/approvals/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision }),
    })
    setBusy(null)
    load()
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Approvals</h1>
          <p className="text-taupe-600 text-sm mt-0.5">{items.filter(i => i.status === 'pending').length} pending</p>
        </div>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> New Request
        </button>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['pending', 'approved', 'rejected', 'all'].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === s ? 'bg-brand-600 text-paper-100' : 'bg-paper-100 text-umber-700 hover:bg-paper-200'
            }`}>{s}</button>
        ))}
      </div>

      {loading ? (
        <div className="card h-40 animate-pulse bg-paper-100" />
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(a => {
            const meta = typeMeta[a.type] ?? typeMeta.other
            const Icon = meta.icon
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-paper-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-umber-700" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{a.title}</p>
                      <p className="text-xs text-taupe-500 mt-0.5">
                        {meta.label} · {a.requester_profile?.full_name ?? 'Team member'} · {formatDate(a.created_at)}
                      </p>
                      {a.details && <p className="text-sm text-umber-700 mt-2 whitespace-pre-wrap">{a.details}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-taupe-600">
                        {a.amount != null && <span>Amount: <strong>{formatCurrency(a.amount)}</strong></span>}
                        {a.start_date && <span>{formatDate(a.start_date)}{a.end_date ? ` → ${formatDate(a.end_date)}` : ''}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {a.status === 'pending' && canDecide ? (
                      <>
                        <button onClick={() => decide(a.id, 'approve')} disabled={busy === a.id}
                          className="btn-primary btn-sm">
                          {busy === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
                        </button>
                        <button onClick={() => decide(a.id, 'reject')} disabled={busy === a.id}
                          className="btn-secondary btn-sm">
                          <X className="w-3 h-3" /> Reject
                        </button>
                      </>
                    ) : (
                      <span className={`badge ${statusStyle[a.status]}`}>{a.status}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card px-6 py-16 text-center">
          <CalendarDays className="w-10 h-10 mx-auto mb-3 text-sand-400" />
          <p className="font-semibold text-ink mb-1" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 20 }}>No {filter === 'all' ? '' : filter} requests</p>
          <p className="text-sm text-taupe-600">Submit a time-off or expense request for approval.</p>
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New approval request">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Type</label>
            <select className={inputClass} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="time_off">Time off / leave</option>
              <option value="expense">Expense reimbursement</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Title *</label>
            <input className={inputClass} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder={form.type === 'time_off' ? 'e.g. Annual leave' : 'e.g. Client lunch'} />
          </div>
          {form.type === 'expense' && (
            <div>
              <label className={labelClass}>Amount (AED)</label>
              <input className={inputClass} type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
          )}
          {form.type === 'time_off' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>From</label>
                <input className={inputClass} type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelClass}>To</label>
                <input className={inputClass} type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Details</label>
            <textarea className={inputClass} rows={3} value={form.details} onChange={e => setForm(f => ({ ...f, details: e.target.value }))} />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit request'}
          </button>
        </form>
      </Modal>
    </div>
  )
}
