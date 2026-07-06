'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, Activity } from 'lucide-react'
import Pagination from '@/components/ui/Pagination'
import EmptyState from '@/components/ui/EmptyState'
import { formatRelativeDate } from '@/lib/utils'

type Entry = {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  created_at: string
}

const ACTION_COLOR: Record<string, string> = {
  create: 'bg-green-50 text-green-700',
  update: 'bg-blue-50 text-blue-700',
  delete: 'bg-red-50 text-red-700',
  grant: 'bg-green-50 text-green-700',
  revoke: 'bg-red-50 text-red-700',
  enable: 'bg-green-50 text-green-700',
  disable: 'bg-red-50 text-red-700',
  invite: 'bg-blue-50 text-blue-700',
  pay: 'bg-green-50 text-green-700',
  run: 'bg-blue-50 text-blue-700',
  send: 'bg-blue-50 text-blue-700',
  convert: 'bg-brand-50 text-brand-700',
}

export default function ActivityLogPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/activity-log?page=${p}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to load activity log')
      setEntries(data.entries ?? [])
      setTotal(data.total ?? 0)
      setError('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(page) }, [load, page])

  const entityTypes = useMemo(() => Array.from(new Set(entries.map((e) => e.entity_type))).sort(), [entries])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (entityFilter && e.entity_type !== entityFilter) return false
      if (!q) return true
      return (
        e.actor_email?.toLowerCase().includes(q) ||
        e.entity_label?.toLowerCase().includes(q) ||
        e.entity_type.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q)
      )
    })
  }, [entries, query, entityFilter])

  const pageCount = Math.max(1, Math.ceil(total / 50))

  if (error) return (
    <div className="card px-6 py-16 text-center">
      <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      <Link href="/settings" className="btn-secondary btn-sm mt-4 inline-flex">Back to settings</Link>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Activity Log</h1>
            <p className="text-gray-500 text-sm mt-0.5">{total} recorded actions — who did what, when</p>
          </div>
        </div>
      </div>

      <div className="card px-4 py-3 mb-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-gray-400"
            placeholder="Search by person, action, or item…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-600 bg-white"
        >
          <option value="">All types</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">When</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Who</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Action</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Item</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length > 0 ? filtered.map((e) => (
                <tr key={e.id} className="table-row">
                  <td className="px-5 py-3 text-gray-400 text-xs whitespace-nowrap">{formatRelativeDate(e.created_at)}</td>
                  <td className="px-5 py-3 text-gray-700">{e.actor_email ?? 'Unknown'}</td>
                  <td className="px-5 py-3">
                    <span className={`badge ${ACTION_COLOR[e.action] ?? 'bg-gray-100 text-gray-600'}`}>{e.action}</span>
                    <span className="text-gray-400 text-xs ml-2">{e.entity_type}</span>
                  </td>
                  <td className="px-5 py-3 text-gray-900 max-w-[280px] truncate">{e.entity_label ?? '—'}</td>
                </tr>
              )) : (
                <EmptyState
                  colSpan={4}
                  icon={Activity}
                  title={entries.length === 0 ? 'No activity recorded yet' : 'No entries match your filters'}
                  helper={entries.length === 0 ? 'Actions across the app will start appearing here.' : 'Try a different search term or type filter.'}
                />
              )}
            </tbody>
          </table></div>
        )}
        <Pagination page={page} pageCount={pageCount} total={total} pageSize={50} onPageChange={setPage} />
      </div>
    </div>
  )
}
