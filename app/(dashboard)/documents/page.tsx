'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Plus, FileSignature, Trash2, Loader2, Upload } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { statusColor, statusLabel, formatDate } from '@/lib/utils'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    const [dRes, cRes] = await Promise.all([fetch('/api/documents'), fetch('/api/clients')])
    const [dData, cData] = await Promise.all([dRes.json(), cRes.json()])
    setDocuments(Array.isArray(dData) ? dData : [])
    setClients(Array.isArray(cData) ? cData : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const resetForm = () => { setTitle(''); setClientId(''); setFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }

  const upload = async () => {
    if (!title.trim() || !clientId || !file) { toast.error('Title, client, and a file are all required'); return }
    setUploading(true)
    try {
      const file_base64 = await fileToBase64(file)
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, title: title.trim(), file_base64, file_name: file.name, mime_type: file.type }),
      })
      const d = await res.json()
      if (res.ok) {
        if (d.emailSent) toast.success('Document uploaded and emailed to the client')
        else toast.error(`Document uploaded, but the client email failed to send: ${d.emailError ?? 'unknown error'}`)
        setShowModal(false); resetForm(); load()
      }
      else toast.error(d.error ?? 'Upload failed')
    } finally { setUploading(false) }
  }

  const deleteDocument = async (id: string) => {
    if (!confirm('Delete this document? This cannot be undone.')) return
    const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Document deleted'); load() }
    else toast.error('Failed to delete document')
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Documents</h1>
          <p className="text-gray-500 text-sm mt-0.5">{documents.length} uploaded · e-signature enabled</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4" /> Upload Document
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Document</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Signed</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.length > 0 ? documents.map((doc) => {
                const agencySig = doc.signatures?.find((s: any) => s.party === 'agency')
                const clientSig = doc.signatures?.find((s: any) => s.party === 'client')
                return (
                  <tr key={doc.id} className="table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileSignature className="w-4 h-4 text-brand-600" />
                        </div>
                        <Link href={`/documents/${doc.id}`} className="font-medium text-gray-900 hover:text-brand-600">{doc.title}</Link>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-gray-600">{doc.client?.company_name ?? '—'}</td>
                    <td className="px-5 py-3"><span className={`badge ${statusColor(doc.status)}`}>{statusLabel(doc.status)}</span></td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {agencySig ? `Agency ✓ ${formatDate(agencySig.signed_at)}` : 'Agency pending'}
                      <br />
                      {clientSig ? `Client ✓ ${formatDate(clientSig.signed_at)}` : 'Client pending'}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/documents/${doc.id}/edit-fields`} className="btn-secondary btn-sm">
                          {doc.fields?.length ? 'Edit fields' : 'Place fields'}
                        </Link>
                        <Link href={`/documents/${doc.id}`} className="btn-secondary btn-sm">Open</Link>
                        <button onClick={() => deleteDocument(doc.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <EmptyState
                  colSpan={5}
                  icon={FileSignature}
                  title="No documents yet"
                  helper="Upload a contract or agreement for you and your client to sign."
                  action={<button className="btn-primary btn-sm inline-flex" onClick={() => setShowModal(true)}><Plus className="w-3 h-3" /> Upload Document</button>}
                />
              )}
            </tbody>
          </table></div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }} title="Upload Document">
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Service Agreement — Acme Corp" />
          </div>
          <div>
            <label className={labelClass}>Client</label>
            <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>File (PDF)</label>
            <input ref={fileInputRef} type="file" accept="application/pdf" className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          <button className="btn-primary w-full justify-center" onClick={upload} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
          </button>
        </div>
      </Modal>
    </div>
  )
}
