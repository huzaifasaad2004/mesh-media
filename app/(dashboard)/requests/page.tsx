'use client'

import { useEffect, useState, useCallback } from 'react'
import { Inbox, ChevronDown } from 'lucide-react'
import { formatDate } from '@/lib/utils'

const STATUS_FLOW = ['open', 'in_progress', 'resolved', 'closed']
const statusStyle: Record<string, string> = {
  open:        'bg-[#F6ECD6] text-[#8a6116]',
  in_progress: 'bg-[#E6E9EE] text-[#4A5A6E]',
  resolved:    'bg-[#E7EFE3] text-[#3F5B3A]',
  closed:      'bg-paper-200 text-taupe-600',
}
const label = (s: string) => s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/requests')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load requests')
      setRequests(Array.isArray(data) ? data : [])
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const setStatus = async (id: string, status: string) => {
    setOpenId(null)
    setRequests(p => p.map(r => r.id === id ? { ...r, status } : r))
    await fetch(`/api/requests/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
  }

  const filtered = filter === 'all' ? requests : requests.filter(r => r.status === filter)
  const openCount = requests.filter(r => r.status === 'open').length

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Requests</h1>
          <p className="text-taupe-600 text-sm mt-0.5">{openCount} open · {requests.length} total</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {['all', ...STATUS_FLOW].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
              filter === s ? 'bg-brand-600 text-paper-100' : 'bg-paper-100 text-umber-700 hover:bg-paper-200'
            }`}>
            {s === 'all' ? 'All' : label(s)}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 px-4 py-2.5 rounded-lg text-sm" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>{error}</div>}

      {loading ? (
        <div className="card h-40 animate-pulse bg-paper-100" />
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map(r => (
            <div key={r.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{r.subject}</p>
                  <p className="text-xs text-taupe-500 mt-0.5">
                    {r.client?.company_name ?? 'Unknown client'} · {formatDate(r.created_at)}
                  </p>
                  {r.body && <p className="text-sm text-umber-700 mt-2 whitespace-pre-wrap">{r.body}</p>}
                </div>
                <div className="relative flex-shrink-0">
                  <button onClick={() => setOpenId(openId === r.id ? null : r.id)}
                    className={`badge cursor-pointer flex items-center gap-1 ${statusStyle[r.status]}`}>
                    {label(r.status)} <ChevronDown className="w-3 h-3" />
                  </button>
                  {openId === r.id && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setOpenId(null)} />
                      <div className="absolute right-0 top-7 z-40 bg-white border border-sand-300 rounded-lg shadow-lg py-1 min-w-[140px]">
                        {STATUS_FLOW.map(s => (
                          <button key={s} onClick={() => setStatus(r.id, s)}
                            className={`w-full text-left px-3 py-2 text-xs hover:bg-paper-50 ${r.status === s ? 'font-semibold text-brand-600' : 'text-umber-700'}`}>
                            {label(s)}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card px-6 py-16 text-center">
          <Inbox className="w-10 h-10 mx-auto mb-3 text-sand-400" />
          <p className="font-semibold text-ink mb-1" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 20 }}>No requests</p>
          <p className="text-sm text-taupe-600">Requests submitted by clients from their portal appear here.</p>
        </div>
      )}
    </div>
  )
}
