'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Headset, Loader2, CheckCircle } from 'lucide-react'

const statusStyle: Record<string, string> = {
  open:        'bg-[#F6ECD6] text-[#8a6116]',
  in_progress: 'bg-[#E6E9EE] text-[#4A5A6E]',
  resolved:    'bg-[#E7EFE3] text-[#3F5B3A]',
  closed:      'bg-paper-200 text-taupe-600',
}
const label = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
const fmt = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

export default function PortalRequests() {
  const [requests, setRequests] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/requests')
    const d = await res.json()
    setRequests(Array.isArray(d) ? d : [])
  }, [])

  useEffect(() => { load() }, [load])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/requests', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject, body }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Failed'); return }
    setSubject(''); setBody(''); setOpen(false); load()
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Requests</h2>
        <button onClick={() => setOpen(o => !o)} className="btn-secondary btn-sm">
          <Plus className="w-3 h-3" /> New request
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="mb-4 p-3 rounded-lg bg-paper-50 border border-sand-300 space-y-2.5">
          <input className="input" placeholder="What do you need?" value={subject} onChange={e => setSubject(e.target.value)} required style={{ fontSize: 16 }} />
          <textarea className="input" rows={3} placeholder="Add any details…" value={body} onChange={e => setBody(e.target.value)} />
          {error && <p className="text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button type="submit" className="btn-primary btn-sm w-full justify-center" disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />} Submit request
          </button>
        </form>
      )}

      {requests.length > 0 ? (
        <div className="divide-y divide-paper-200">
          {requests.map(r => (
            <div key={r.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{r.subject}</p>
                {r.body && <p className="text-xs text-taupe-600 mt-0.5 line-clamp-2">{r.body}</p>}
                <p className="text-[11px] text-taupe-500 mt-1">{fmt(r.created_at)}</p>
              </div>
              <span className={`badge flex-shrink-0 ${statusStyle[r.status]}`}>{label(r.status)}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <Headset className="w-8 h-8 mx-auto mb-2 text-sand-400" />
          <p className="text-sm text-taupe-600">Need something? Submit a request and we&apos;ll get on it.</p>
        </div>
      )}
    </div>
  )
}
