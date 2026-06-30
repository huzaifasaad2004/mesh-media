import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'
import { Plus, FileSignature } from 'lucide-react'
import type { Contract } from '@/types/database'

export default async function ContractsPage() {
  const supabase = createClient()
  const { data: contracts } = await supabase
    .from('contracts')
    .select('*, client:clients(company_name), creator:profiles(full_name)')
    .order('created_at', { ascending: false })

  const statusGroups = ['draft', 'sent', 'signed', 'expired', 'cancelled']
  const counts = statusGroups.reduce((acc, s) => {
    acc[s] = contracts?.filter((c: any) => c.status === s).length ?? 0
    return acc
  }, {} as Record<string, number>)

  const totalValue = contracts
    ?.filter((c: any) => c.status === 'signed')
    .reduce((sum: number, c: any) => sum + (c.value ?? 0), 0) ?? 0

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Contracts</h1>
          <p className="text-gray-500 text-sm mt-0.5">{contracts?.length ?? 0} contracts · {formatCurrency(totalValue)} signed value</p>
        </div>
        <button className="btn-primary">
          <Plus className="w-4 h-4" /> New Contract
        </button>
      </div>

      {/* Status cards */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {statusGroups.map((s) => (
          <div key={s} className="card px-4 py-2.5 flex items-center gap-2.5">
            <span className={`badge ${statusColor(s)}`}>{statusLabel(s)}</span>
            <span className="text-sm font-semibold text-gray-800">{counts[s]}</span>
          </div>
        ))}
      </div>

      {/* Contracts table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Contract</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Value</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Period</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
              <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Created By</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {contracts && contracts.length > 0 ? (contracts as any[]).map((contract) => (
              <tr key={contract.id} className="table-row">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileSignature className="w-4 h-4 text-purple-500" />
                    </div>
                    <span className="font-medium text-gray-900">{contract.title}</span>
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-600">{contract.client?.company_name ?? '—'}</td>
                <td className="px-5 py-3 font-semibold">{contract.value ? formatCurrency(contract.value) : '—'}</td>
                <td className="px-5 py-3 text-gray-500 text-xs">
                  {formatDate(contract.start_date)} → {formatDate(contract.end_date)}
                </td>
                <td className="px-5 py-3">
                  <span className={`badge ${statusColor(contract.status)}`}>{statusLabel(contract.status)}</span>
                </td>
                <td className="px-5 py-3 text-gray-500">{contract.creator?.full_name ?? '—'}</td>
                <td className="px-5 py-3">
                  <div className="flex justify-end gap-1">
                    <button className="btn-secondary btn-sm">View</button>
                    {contract.status === 'draft' && (
                      <button className="btn-primary btn-sm">Send</button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={7} className="px-5 py-16 text-center">
                  <FileSignature className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No contracts yet</p>
                  <button className="btn-primary btn-sm mt-4 inline-flex">
                    <Plus className="w-3 h-3" /> Create first contract
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
