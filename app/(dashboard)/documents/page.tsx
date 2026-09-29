'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, FileSignature, Trash2, Loader2, Upload, UserPlus, Download, ShieldCheck, PenLine, Mail, Send, Archive } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { statusColor, statusLabel, formatDate } from '@/lib/utils'
import { MAX_DIRECT_UPLOAD_BYTES, MAX_DIRECT_UPLOAD_LABEL } from '@/lib/uploadLimits'
import { documentFileHref } from '@/lib/documentFileLinks'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

const ROLE_LABEL: Record<string, string> = { agency: 'Agency', client: 'Client', employee: 'Employee', other: 'Other' }

interface RecipientDraft { name: string; email: string; role: 'agency' | 'client' | 'employee' | 'other' }

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [clients, setClients] = useState<{ id: string; company_name: string; email?: string; contact_person?: string }[]>([])
  const [canWrite, setCanWrite] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mode, setMode] = useState<'sign' | 'stored'>('sign')
  const [resendingId, setResendingId] = useState('')
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [clientId, setClientId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [recipients, setRecipients] = useState<RecipientDraft[]>([{ name: '', email: '', role: 'agency' }, { name: '', email: '', role: 'client' }])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    const [dRes, cRes, meRes] = await Promise.all([fetch('/api/documents'), fetch('/api/clients'), fetch('/api/profiles/me')])
    const [dData, cData, me] = await Promise.all([dRes.json(), cRes.json(), meRes.json()])
    setDocuments(Array.isArray(dData) ? dData : [])
    setClients(Array.isArray(cData) ? cData : [])
    setCanWrite(!!me?.permissions?.includes('documents.write') || ['owner', 'admin', 'manager'].includes(me?.role))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // /documents?upload=signed (linked from Document Studio) opens straight into "Already signed".
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('upload') === 'signed') { setMode('stored'); setShowModal(true) }
  }, [])

  const resetForm = () => {
    setTitle(''); setClientId(''); setFile(null); setMode('sign')
    setRecipients([{ name: '', email: '', role: 'agency' }, { name: '', email: '', role: 'client' }])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const addRecipient = () => setRecipients((prev) => [...prev, { name: '', email: '', role: 'other' }])
  const removeRecipient = (i: number) => setRecipients((prev) => prev.filter((_, idx) => idx !== i))
  const updateRecipient = (i: number, patch: Partial<RecipientDraft>) =>
    setRecipients((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))

  const fillFromClient = (id: string) => {
    setClientId(id)
    const client = clients.find((c) => c.id === id)
    if (!client) return
    setRecipients((prev) => prev.map((r) => (r.role === 'client' && !r.name && !r.email
      ? { ...r, name: client.contact_person || client.company_name, email: client.email || '' }
      : r)))
  }

  const upload = async () => {
    const stored = mode === 'stored'
    const validRecipients = recipients.filter((r) => r.name.trim() && r.email.trim())
    if (!title.trim() || !file) { toast.error('Title and a file are required'); return }
    if (file.size > MAX_DIRECT_UPLOAD_BYTES) { toast.error(`That file is too large (max ${MAX_DIRECT_UPLOAD_LABEL})`); return }
    if (stored && !clientId) { toast.error('Choose the client whose portal this belongs in'); return }
    if (!stored && validRecipients.length === 0) { toast.error('Add at least one recipient (name + email) to sign'); return }
    if (!stored && validRecipients.some((r) => r.role === 'client') && !clientId
      && !confirm('No client is selected, so this won\'t appear in any client portal — signers can still use their emailed link. Continue?')) return
    setUploading(true)
    try {
      const file_base64 = await fileToBase64(file)
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId || null, title: title.trim(), file_base64, file_name: file.name, mime_type: file.type,
          ...(stored ? { already_signed: true } : { recipients: validRecipients }),
        }),
      })
      const d = await res.json()
      if (!res.ok) { toast.error(d.error ?? 'Upload failed'); return }
      setShowModal(false); resetForm()
      if (stored) {
        toast.success('Signed copy saved — it now shows in the client portal')
        load()
      } else {
        toast.success('Uploaded — now place the signature boxes, then press "Save & send"')
        router.push(`/documents/${d.id}/edit-fields`)
      }
    } finally { setUploading(false) }
  }

  const resendLinks = async (doc: any) => {
    if (!confirm(`Email a fresh signing link to everyone who hasn't signed "${doc.title}" yet?`)) return
    setResendingId(doc.id)
    const res = await fetch(`/api/documents/${doc.id}/send`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    const d = await res.json().catch(() => ({}))
    setResendingId('')
    if (!res.ok) { toast.error(d.error ?? 'Could not send the links'); return }
    const results = d.emailResults ?? []
    const failed = results.filter((r: any) => !r.sent)
    if (results.length === 0) toast.success('Everyone has already signed')
    else if (failed.length) toast.error(`${failed.length} of ${results.length} email(s) failed to send`)
    else toast.success(`Signing link sent to ${results.map((r: any) => r.email).join(', ')}`)
    load()
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
        <div className="flex items-center gap-2">
          <Link href="/documents/studio" className="btn-secondary"><PenLine className="w-4 h-4" /> Document Studio</Link>
          {canWrite && (
            <button className="btn-secondary" onClick={() => { setMode('stored'); setShowModal(true) }}>
              <Archive className="w-4 h-4" /> Store signed contract
            </button>
          )}
          {canWrite && (
            <button className="btn-primary" onClick={() => { setMode('sign'); setShowModal(true) }}>
              <Plus className="w-4 h-4" /> Upload for signature
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Document</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Recipients</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Signed</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documents.length > 0 ? documents.map((doc) => (
                <tr key={doc.id} className="table-row">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
                        <FileSignature className="w-4 h-4 text-brand-600" />
                      </div>
                      <Link href={`/documents/${doc.id}`} className="font-medium text-gray-900 hover:text-brand-600">{doc.title}</Link>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-gray-600">{doc.client?.company_name ?? `${doc.recipients?.length ?? 0} recipient(s)`}</td>
                  <td className="px-5 py-3"><span className={`badge ${statusColor(doc.status)}`}>{statusLabel(doc.status)}</span></td>
                  <td className="px-5 py-3 text-gray-500 text-xs">
                    {doc.status === 'signed' && (doc.recipients?.length ?? 0) === 0 && <span className="inline-flex items-center gap-1"><Archive className="w-3 h-3" /> Signed copy on file</span>}
                    {(doc.recipients ?? []).map((r: any) => (
                      <div key={r.id}>{r.name} ({ROLE_LABEL[r.role] ?? r.role}) {r.signed_at ? `✓ ${formatDate(r.signed_at)}` : '· pending'}</div>
                    ))}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {doc.completion_certificate_url && (
                        <a href={documentFileHref(doc.id, 'certificate')} target="_blank" rel="noreferrer" title="Certificate of Completion" className="w-7 h-7 flex items-center justify-center rounded text-green-700 hover:bg-green-50">
                          <ShieldCheck className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {doc.merged_file_url && (
                        <a href={documentFileHref(doc.id, 'signed')} target="_blank" rel="noreferrer" title="Signed PDF" className="w-7 h-7 flex items-center justify-center rounded text-gray-500 hover:bg-gray-50">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {canWrite && doc.fields?.length > 0 && (doc.recipients ?? []).some((r: any) => !r.signed_at) && !['signed', 'cancelled'].includes(doc.status) && (
                        <button onClick={() => resendLinks(doc)} disabled={resendingId === doc.id} title="Resend signing links to everyone who hasn't signed" className="btn-secondary btn-sm">
                          {resendingId === doc.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Resend links
                        </button>
                      )}
                      {canWrite && (doc.recipients?.length ?? 0) > 0 && doc.status !== 'signed' && (
                        <Link href={`/documents/${doc.id}/edit-fields`} className="btn-secondary btn-sm">
                          {doc.fields?.length ? 'Edit fields' : 'Place fields & send'}
                        </Link>
                      )}
                      <Link href={`/documents/${doc.id}`} className="btn-secondary btn-sm">Open</Link>
                      {canWrite && (
                        <button onClick={() => deleteDocument(doc.id)} className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )) : (
                <EmptyState
                  colSpan={5}
                  icon={FileSignature}
                  title="No documents yet"
                  helper="Upload a contract or agreement for anyone to sign."
                  action={canWrite ? <button className="btn-primary btn-sm inline-flex" onClick={() => setShowModal(true)}><Plus className="w-3 h-3" /> Upload Document</button> : undefined}
                />
              )}
            </tbody>
          </table></div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm() }} title={mode === 'stored' ? 'Store a Signed Copy' : 'Upload Document'} size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-1 bg-paper-200 rounded-lg p-1">
            <button type="button" onClick={() => setMode('sign')} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'sign' ? 'bg-white text-ink shadow-sm' : 'text-taupe-600'}`}>
              <Send className="w-3.5 h-3.5 inline mr-1.5" />Send for signature
            </button>
            <button type="button" onClick={() => setMode('stored')} className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${mode === 'stored' ? 'bg-white text-ink shadow-sm' : 'text-taupe-600'}`}>
              <Archive className="w-3.5 h-3.5 inline mr-1.5" />Already signed
            </button>
          </div>
          <p className="text-xs text-taupe-500 -mt-2">
            {mode === 'sign'
              ? 'Upload the PDF, then place signature boxes. Signers get their links by email when you press "Save & send".'
              : 'For contracts signed outside the app (on paper or by email). The PDF is saved as signed and appears in the client\'s portal straight away — nobody is emailed.'}
          </p>
          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Service Agreement — Acme Corp" />
          </div>
          <div>
            <label className={labelClass}>{mode === 'stored' ? 'Client' : 'Client (shows it in their portal)'}</label>
            <select className={inputClass} value={clientId} onChange={(e) => fillFromClient(e.target.value)}>
              <option value="">{mode === 'stored' ? 'Choose a client…' : 'No CRM client — just add recipients below'}</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.company_name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{mode === 'stored' ? 'Signed PDF' : 'File'} (PDF, under {MAX_DIRECT_UPLOAD_LABEL})</label>
            <input ref={fileInputRef} type="file" accept="application/pdf" className={inputClass} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {mode === 'sign' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelClass}>Recipients — anyone who needs to sign</label>
              <button type="button" onClick={addRecipient} className="btn-ghost btn-sm"><UserPlus className="w-3.5 h-3.5" /> Add recipient</button>
            </div>
            <div className="space-y-2">
              {recipients.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] sm:flex gap-2 items-center">
                  <input className={`${inputClass} sm:flex-1`} placeholder="Full name" value={r.name} onChange={(e) => updateRecipient(i, { name: e.target.value })} />
                  <button type="button" onClick={() => removeRecipient(i)} className="sm:order-last w-8 h-8 flex-shrink-0 flex items-center justify-center rounded text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <input className={`${inputClass} sm:flex-1`} placeholder="Email address" type="email" value={r.email} onChange={(e) => updateRecipient(i, { email: e.target.value })} />
                  <select className={`${inputClass} sm:w-[120px]`} value={r.role} onChange={(e) => updateRecipient(i, { role: e.target.value as RecipientDraft['role'] })}>
                    <option value="agency">Agency</option>
                    <option value="client">Client</option>
                    <option value="employee">Employee</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Each recipient gets their own personal signing link by email — no account needed. Clients can also sign from their portal.</p>
          </div>
          )}

          <button className="btn-primary w-full justify-center" onClick={upload} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {mode === 'stored' ? 'Save to client portal' : 'Upload & place signature boxes'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
