'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, FileSignature, Pencil, Trash2, ExternalLink, Upload } from 'lucide-react'
import Link from 'next/link'
import Modal from '@/components/ui/Modal'
import ContractForm from '@/components/forms/ContractForm'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, statusColor, statusLabel } from '@/lib/utils'

export default function ContractsPage() {
  const [contracts, setContracts] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [documents, setDocuments] = useState<{ id: string; title: string; status: string; client_id: string | null }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingContract, setEditingContract] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  const fetchContracts = useCallback(async () => {
    const res = await fetch('/api/contracts')
    const data = await res.json()
    setContracts(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchContracts()
    fetch('/api/clients').then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : []))
    fetch('/api/documents').then((r) => r.json()).then((d) => setDocuments(Array.isArray(d) ? d : []))
  }, [fetchContracts])

  const deleteContract = async (id: string) => {
    if (!confirm('Delete this contract?')) return
    const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Contract deleted'); fetchContracts() }
    else toast.error('Failed to delete contract')
  }

  const openEdit = (contract: any) => {
    setEditingContract(contract)
    setShowModal(true)
  }

  const handleClose = () => {
    setShowModal(false)
    setEditingContract(null)
  }

  const handleSuccess = () => {
    handleClose()
    fetchContracts()
  }

  const statusGroups = ['draft', 'sent', 'signed', 'expired', 'cancelled']
  const counts = statusGroups.reduce((acc, s) => {
    acc[s] = contracts.filter((c) => c.status === s).length
    return acc
  }, {} as Record<string, number>)
  const totalValue = contracts.filter((c) => c.status === 'signed').reduce((sum, c) => sum + (c.value ?? 0), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Contracts</h1>
          <p className="text-gray-500 text-sm mt-0.5">Commercial register for agreement value, dates, renewals, and signing status · {formatCurrency(totalValue)} signed value</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/documents" className="btn-secondary"><Upload className="w-4 h-4" /> Upload for signature</Link>
          <button className="btn-primary" onClick={() => { setEditingContract(null); setShowModal(true) }}><Plus className="w-4 h-4" /> New Contract</button>
        </div>
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
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
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
              {contracts.length > 0 ? contracts.map((contract) => (
                <tr key={contract.id} className="table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileSignature className="w-4 h-4 text-brand-600" />
                      </div>
                      <span className="font-medium text-gray-900">{contract.title}</span>
                      {contract.document && (
                        <a href={contract.document.merged_file_url ?? contract.document.file_url} target="_blank" rel="noreferrer" title="Open linked signed document" className="text-brand-600 hover:text-brand-700">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
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
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(contract)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => deleteContract(contract.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyState
                  colSpan={7}
                  icon={FileSignature}
                  title="No contracts yet"
                  helper="Track signed agreements and their value here."
                  action={<button className="btn-primary btn-sm inline-flex" onClick={() => setShowModal(true)}><Plus className="w-3 h-3" /> Create first contract</button>}
                />
              )}
            </tbody>
          </table></div>
        )}
      </div>

      <Modal
        isOpen={showModal}
        onClose={handleClose}
        title={editingContract ? 'Edit Contract' : 'New Contract'}
        size="lg"
      >
        <ContractForm
          key={editingContract?.id ?? 'new'}
          onSuccess={handleSuccess}
          clients={clients}
          documents={documents}
          initialData={editingContract ?? undefined}
        />
      </Modal>
    </div>
  )
}
