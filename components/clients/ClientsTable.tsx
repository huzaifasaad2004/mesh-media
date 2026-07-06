'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, ExternalLink } from 'lucide-react'
import { formatCurrency, statusColor, statusLabel } from '@/lib/utils'
import type { Client } from '@/types/database'
import InvitePortalButton from '@/components/clients/InvitePortalButton'
import Pagination from '@/components/ui/Pagination'
import EmptyState from '@/components/ui/EmptyState'

const PAGE_SIZE = 10

export default function ClientsTable({ clients }: { clients: Client[] }) {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const statusGroups = ['active', 'onboarding', 'lead', 'paused', 'churned']
  const counts = statusGroups.reduce((acc, s) => {
    acc[s] = clients.filter((c) => c.status === s).length
    return acc
  }, {} as Record<string, number>)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return clients.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false
      if (!q) return true
      return (
        c.company_name?.toLowerCase().includes(q) ||
        c.industry?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    })
  }, [clients, query, statusFilter])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients.length} total clients</p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Add Client
        </Link>
      </div>

      {/* Status overview */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {statusGroups.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1) }}
            className={`card px-4 py-2.5 flex items-center gap-2.5 transition-all ${statusFilter === s ? 'ring-2 ring-brand-600' : 'hover:shadow-sm'}`}
          >
            <span className={`badge ${statusColor(s)}`}>{statusLabel(s)}</span>
            <span className="text-sm font-semibold text-gray-800">{counts[s]}</span>
          </button>
        ))}
      </div>

      {/* Client table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-gray-400"
            placeholder="Search clients…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1) }}
          />
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Company</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Industry</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Retainer</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Email</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.length > 0 ? visible.map((client) => (
              <tr key={client.id} className="table-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {client.company_name[0].toUpperCase()}
                    </div>
                    <Link href={`/clients/${client.id}`} className="font-medium text-gray-900 hover:text-brand-600 transition-colors">
                      {client.company_name}
                    </Link>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-500">{client.industry ?? '—'}</td>
                <td className="px-5 py-3"><span className={`badge ${statusColor(client.status)}`}>{statusLabel(client.status)}</span></td>
                <td className="px-5 py-3 font-medium">{client.monthly_retainer ? formatCurrency(client.monthly_retainer) + '/mo' : '—'}</td>
                <td className="px-5 py-3 text-gray-500">{client.email ?? '—'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {client.drive_folder_url && (
                      <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                        <ExternalLink className="w-3 h-3" /> Drive
                      </a>
                    )}
                    <InvitePortalButton clientId={client.id} disabled={!client.email} />
                    <Link href={`/clients/${client.id}`} className="btn-secondary btn-sm">View</Link>
                    <Link href={`/clients/${client.id}/edit`} className="btn-ghost btn-sm">Edit</Link>
                  </div>
                </td>
              </tr>
            )) : (
              <EmptyState
                colSpan={6}
                title={clients.length === 0 ? 'No clients yet' : 'No clients match your search'}
                helper={clients.length === 0 ? 'Add your first client to start tracking projects and invoices.' : 'Try a different search term or status filter.'}
                action={clients.length === 0 ? <Link href="/clients/new" className="btn-primary btn-sm inline-flex"><Plus className="w-3 h-3" /> Add your first client</Link> : undefined}
              />
            )}
          </tbody>
        </table></div>
        <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </div>
  )
}
