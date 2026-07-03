'use client'

import { useState } from 'react'
import { Check, X, Eye, Loader2 } from 'lucide-react'

export default function PortalQuoteActions({ quoteId, quoteStatus }: { quoteId: string; quoteStatus: string }) {
  const [status, setStatus] = useState(quoteStatus)
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState('')

  const respond = async (decision: 'accept' | 'decline') => {
    setLoading(decision); setError('')
    try {
      const res = await fetch(`/api/portal/quotations/${quoteId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed')
      setStatus(d.status)
    } catch (e: any) { setError(e.message) } finally { setLoading(null) }
  }

  const pending = ['sent', 'draft'].includes(status)

  return (
    <div className="mt-3">
      {pending ? (
        <div className="flex gap-2">
          <button onClick={() => respond('accept')} disabled={loading !== null}
            className="btn-primary btn-sm flex-1 justify-center">
            {loading === 'accept' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Approve
          </button>
          <button onClick={() => respond('decline')} disabled={loading !== null}
            className="btn-secondary btn-sm flex-1 justify-center">
            {loading === 'decline' ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />} Decline
          </button>
          <a href={`/quotation/${quoteId}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
            <Eye className="w-3 h-3" /> View
          </a>
        </div>
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
