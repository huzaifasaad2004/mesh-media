import { createClient } from '@/lib/supabase/server'
import { formatCurrency, statusColor, statusLabel } from '@/lib/utils'
import Link from 'next/link'
import { Plus, Search, ExternalLink } from 'lucide-react'
import type { Client } from '@/types/database'

export default async function ClientsPage() {
  const supabase = createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  const statusGroups = ['active', 'onboarding', 'lead', 'paused', 'churned']
  const counts = statusGroups.reduce((acc, s) => {
    acc[s] = clients?.filter((c: Client) => c.status === s).length ?? 0
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p className="text-gray-500 text-sm mt-0.5">{clients?.length ?? 0} total clients</p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Add Client
        </Link>
      </div>

      {/* Status overview */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {statusGroups.map((s) => (
          <div key={s} className="card px-4 py-2.5 flex items-center gap-2.5">
            <span className={`badge ${statusColor(s)}`}>{statusLabel(s)}</span>
            <span className="text-sm font-semibold text-gray-800">{counts[s]}</span>
          </div>
        ))}
      </div>

      {/* Client table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-gray-400" placeholder="Search clients…" />
        </div>
        <table className="w-full text-sm">
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
            {clients && clients.length > 0 ? (clients as Client[]).map((client) => (
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
                    <Link href={`/clients/${client.id}`} className="btn-secondary btn-sm">View</Link>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center">
                  <p className="text-gray-400 text-sm">No clients yet</p>
                  <Link href="/clients/new" className="btn-primary btn-sm mt-4 inline-flex">
                    <Plus className="w-3 h-3" /> Add your first client
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
