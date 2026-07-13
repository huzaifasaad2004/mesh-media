'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Plus, Users, Loader2 } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import ContractorForm from '@/components/forms/ContractorForm'
import { formatCurrency } from '@/lib/utils'

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<any[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const load = useCallback(async () => {
    const [cRes, meRes] = await Promise.all([fetch('/api/contractors'), fetch('/api/profiles/me')])
    const c = await cRes.json()
    setContractors(Array.isArray(c) ? c : [])
    try {
      const me = await meRes.json()
      setCanManage((me?.permissions ?? []).includes('contractors.write'))
    } catch { /* stays false */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const totalsFor = (payments: any[]) =>
    payments.reduce((totals: Record<string, number>, p) => {
      const c = p.currency ?? 'AED'
      totals[c] = (totals[c] ?? 0) + Number(p.amount)
      return totals
    }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Contractors</h1>
          <p className="text-gray-500 text-sm mt-0.5">{contractors.length} contractor(s) · project-based, paid outside payroll</p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Add Contractor
          </button>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Contractor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Contact</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Total Paid</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {contractors.length > 0 ? contractors.map((c) => {
                const totals = totalsFor(c.payments ?? [])
                return (
                  <tr key={c.id} className="table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {c.name[0]}
                        </div>
                        <Link href={`/contractors/${c.id}`} className="font-medium text-gray-900 hover:text-brand-600">{c.name}</Link>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-500">{c.email ?? c.phone ?? '—'}</td>
                    <td className="px-5 py-3 text-gray-700">
                      {Object.keys(totals).length > 0
                        ? Object.entries(totals).map(([cur, total]) => formatCurrency(total, cur)).join(' + ')
                        : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link href={`/contractors/${c.id}`} className="btn-secondary btn-sm">Open</Link>
                    </td>
                  </tr>
                )
              }) : (
                <EmptyState
                  colSpan={5}
                  icon={Users}
                  title="No contractors yet"
                  helper="Add a freelancer or project-based contractor to start tracking their payments."
                  action={canManage ? <button className="btn-primary btn-sm inline-flex" onClick={() => setShowModal(true)}><Plus className="w-3 h-3" /> Add Contractor</button> : undefined}
                />
              )}
            </tbody>
          </table></div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add Contractor">
        <ContractorForm onSuccess={() => { setShowModal(false); load() }} />
      </Modal>
    </div>
  )
}
