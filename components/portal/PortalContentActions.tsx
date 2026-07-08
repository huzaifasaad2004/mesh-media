'use client'

import { useState } from 'react'
import { Check, X, ExternalLink, Loader2 } from 'lucide-react'

export default function PortalContentActions({ itemId, itemStatus }: { itemId: string; itemStatus: string }) {
  const [status, setStatus] = useState(itemStatus)
  const [loading, setLoading] = useState<'approve' | 'decline' | null>(null)
  const [error, setError] = useState('')
  const [declining, setDeclining] = useState(false)
  const [comment, setComment] = useState('')

  const respondApprove = async () => {
    setLoading('approve'); setError('')
    try {
      const res = await fetch(`/api/portal/content-items/${itemId}/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'approve' }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setStatus(d.status)
    } catch (e: any) { setError(e.message) } finally { setLoading(null) }
  }

  const submitDecline = async () => {
    if (!comment.trim()) { setError('Please add a comment so the team knows what to change'); return }
    setLoading('decline'); setError('')
    try {
      const res = await fetch(`/api/portal/content-items/${itemId}/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision: 'decline', comment }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setStatus(d.status)
      setDeclining(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(null) }
  }

  const pending = status === 'pending_client'

  return (
    <div className="mt-2">
      {pending ? (
        declining ? (
          <div className="space-y-2 bg-paper-50 border border-sand-300 rounded-lg p-3">
            <label className="text-xs font-medium text-umber-700">What needs to change?</label>
            <textarea className="input" rows={2} placeholder="Tell us what you'd like adjusted…"
              value={comment} onChange={e => setComment(e.target.value)} style={{ fontSize: 13 }} />
            <div className="flex gap-2">
              <button onClick={submitDecline} disabled={loading !== null} className="btn-secondary btn-sm flex-1 justify-center">
                {loading === 'decline' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Confirm
              </button>
              <button onClick={() => { setDeclining(false); setError('') }} className="btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={respondApprove} disabled={loading !== null} className="btn-primary btn-sm flex-1 justify-center">
              {loading === 'approve' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
            </button>
            <button onClick={() => setDeclining(true)} disabled={loading !== null} className="btn-secondary btn-sm flex-1 justify-center">
              <X className="w-3 h-3" /> Request changes
            </button>
          </div>
        )
      ) : (
        <span className="text-sm font-medium" style={{ color: status === 'client_approved' ? 'var(--success)' : 'var(--danger)' }}>
          You {status === 'client_approved' ? 'approved' : 'requested changes on'} this
        </span>
      )}
      {error && <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
