'use client'

import { useState } from 'react'
import { Check, X, Eye, Loader2 } from 'lucide-react'
import SignaturePad from '@/components/esign/SignaturePad'

const DECLINE_REASONS = [
  'Price is too high',
  'Went with another agency',
  'No longer needed',
  'Need to revisit scope',
  'Other',
]

export default function PortalQuoteActions({ quoteId, quoteStatus }: { quoteId: string; quoteStatus: string }) {
  const [status, setStatus] = useState(quoteStatus)
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState('')
  const [declining, setDeclining] = useState(false)
  const [signing, setSigning] = useState(false)
  const [reasonChoice, setReasonChoice] = useState(DECLINE_REASONS[0])
  const [reasonDetail, setReasonDetail] = useState('')

  const respondAccept = async (payload: { name: string; dataUrl: string | null }) => {
    setLoading('accept'); setError('')
    try {
      const res = await fetch(`/api/portal/quotations/${quoteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'accept', signature_name: payload.name, signature_data: payload.dataUrl }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setStatus(d.status)
      setSigning(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(null) }
  }

  const submitDecline = async () => {
    const reason = reasonChoice === 'Other' ? reasonDetail.trim() : reasonChoice + (reasonDetail.trim() ? ` — ${reasonDetail.trim()}` : '')
    if (!reason) { setError('Please add a bit more detail'); return }
    setLoading('decline'); setError('')
    try {
      const res = await fetch(`/api/portal/quotations/${quoteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'decline', reason }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setStatus(d.status)
      setDeclining(false)
    } catch (e: any) { setError(e.message) } finally { setLoading(null) }
  }

  const pending = ['sent', 'draft'].includes(status)

  return (
    <div className="mt-3">
      {pending ? (
        signing ? (
          <div className="bg-paper-50 border border-sand-300 rounded-lg p-3">
            <p className="text-xs font-medium text-umber-700 mb-2">Sign to accept this quotation</p>
            <SignaturePad submitting={loading === 'accept'} onSubmit={respondAccept} submitLabel="Sign & Accept" />
            <button onClick={() => { setSigning(false); setError('') }} className="btn-ghost btn-sm mt-2">Cancel</button>
          </div>
        ) : declining ? (
          <div className="space-y-2 bg-paper-50 border border-sand-300 rounded-lg p-3">
            <label className="text-xs font-medium text-umber-700">Why are you declining?</label>
            <select className="input" value={reasonChoice} onChange={e => setReasonChoice(e.target.value)} style={{ fontSize: 13 }}>
              {DECLINE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <textarea className="input" rows={2} placeholder={reasonChoice === 'Other' ? 'Tell us more…' : 'Any extra detail (optional)'}
              value={reasonDetail} onChange={e => setReasonDetail(e.target.value)} style={{ fontSize: 13 }} />
            <div className="flex gap-2">
              <button onClick={submitDecline} disabled={loading !== null} className="btn-secondary btn-sm flex-1 justify-center">
                {loading === 'decline' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Confirm decline
              </button>
              <button onClick={() => { setDeclining(false); setError('') }} className="btn-ghost btn-sm">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setSigning(true)} disabled={loading !== null}
              className="btn-primary btn-sm flex-1 justify-center">
              <Check className="w-3 h-3" /> Approve
            </button>
            <button onClick={() => setDeclining(true)} disabled={loading !== null}
              className="btn-secondary btn-sm flex-1 justify-center">
              <X className="w-3 h-3" /> Decline
            </button>
            <a href={`/quotation/${quoteId}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
              <Eye className="w-3 h-3" /> View
            </a>
          </div>
        )
      ) : (
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium" style={{ color: status === 'accepted' ? 'var(--success)' : status === 'declined' ? 'var(--danger)' : 'var(--taupe-600)' }}>
            You {status} this quotation
          </span>
          <a href={`/quotation/${quoteId}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
            <Eye className="w-3 h-3" /> View
          </a>
        </div>
      )}
      {error && <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{error}</p>}
    </div>
  )
}
