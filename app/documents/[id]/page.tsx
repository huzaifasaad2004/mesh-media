'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle, Download } from 'lucide-react'
import SignaturePad from '@/components/esign/SignaturePad'
import PdfPageCanvas from '@/components/esign/PdfPageCanvas'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatDate, statusColor, statusLabel } from '@/lib/utils'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer']
const FIELD_COLOR: Record<string, string> = { agency: '#6E1318', client: '#4A5A6E' }

export default function DocumentSignerPage() {
  const { id } = useParams<{ id: string }>()
  const [me, setMe] = useState<{ role: string; full_name: string | null } | null>(null)
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signingParty, setSigningParty] = useState<'agency' | 'client' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [live, setLive] = useState<{ name: string; dataUrl: string | null }>({ name: '', dataUrl: null })
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 })
  const [activeField, setActiveField] = useState<any>(null)
  const [fieldSubmitting, setFieldSubmitting] = useState(false)
  const toast = useToast()

  const load = async () => {
    try {
      const [meRes, docRes] = await Promise.all([fetch('/api/profiles/me'), fetch(`/api/documents/${id}`)])
      const meData = await meRes.json().catch(() => null)
      const docData = await docRes.json()
      if (!docRes.ok) throw new Error(docData.error ?? 'Failed to load document')
      setMe(meRes.ok ? meData : null)
      setDoc(docData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const submitSignature = async (party: 'agency' | 'client', payload: { name: string; dataUrl: string | null }) => {
    setSubmitting(true)
    const res = await fetch(`/api/documents/${id}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ party, signer_name: payload.name, signature_data: payload.dataUrl }),
    })
    const d = await res.json()
    setSubmitting(false)
    if (res.ok) { toast.success('Signed successfully'); setSigningParty(null); load() }
    else toast.error(d.error ?? 'Failed to sign')
  }

  const submitFieldValue = async (value: string) => {
    if (!activeField) return
    setFieldSubmitting(true)
    const res = await fetch(`/api/documents/${id}/fields/${activeField.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    })
    const d = await res.json()
    setFieldSubmitting(false)
    if (res.ok) {
      toast.success(d.status === 'signed' ? 'All fields complete — document signed!' : 'Field saved')
      if (d.mergeError) toast.error(`Field saved, but the final merged PDF failed to generate: ${d.mergeError}`)
      setActiveField(null)
      load()
    } else toast.error(d.error ?? 'Failed to save field')
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading document…</div>
  if (error || !doc) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm" style={{ color: 'var(--danger, #B23A2E)' }}>{error || 'Document not found'}</p>
        <Link href="/login" className="text-brand-600 text-sm hover:underline mt-2 inline-block">Sign in</Link>
      </div>
    </div>
  )

  const isStaff = me ? STAFF_ROLES.includes(me.role) : false
  const backHref = isStaff ? '/documents' : '/portal'
  const myParty: 'agency' | 'client' | null = isStaff ? 'agency' : me ? 'client' : null
  const hasFields = (doc.fields?.length ?? 0) > 0

  if (hasFields) {
    const pageFields = doc.fields.filter((f: any) => f.page_number === page)
    const filledCount = doc.fields.filter((f: any) => f.value).length
    const canFill = (f: any) => f.assigned_party === myParty && !f.value

    return (
      <div className="min-h-screen bg-paper-0">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>

          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h1 className="text-2xl font-display" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{doc.title}</h1>
              <p className="text-sm text-gray-500 mt-0.5">{doc.client?.company_name} · {filledCount} / {doc.fields.length} fields complete</p>
            </div>
            <div className="flex items-center gap-2">
              {doc.merged_file_url && (
                <a href={doc.merged_file_url} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
                  <Download className="w-3.5 h-3.5" /> Signed PDF
                </a>
              )}
              <span className={`badge ${statusColor(doc.status)}`}>{statusLabel(doc.status)}</span>
            </div>
          </div>

          {numPages > 1 && (
            <div className="flex items-center gap-2 text-xs mb-3">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">Prev</button>
              <span>Page {page} / {numPages}</span>
              <button onClick={() => setPage((p) => Math.min(numPages, p + 1))} disabled={page === numPages} className="btn-secondary btn-sm">Next</button>
            </div>
          )}

          <div className="relative inline-block">
            <PdfPageCanvas fileUrl={doc.file_url} pageNumber={page} width={700} onDocumentLoad={setNumPages} onPageRender={setRenderSize}>
              {pageFields.map((f: any) => {
                const style = {
                  left: f.x * renderSize.width, top: f.y * renderSize.height,
                  width: f.width * renderSize.width, height: f.height * renderSize.height,
                }
                if (f.value) {
                  return (
                    <div key={f.id} className="absolute flex items-center justify-center rounded border-2 bg-white/90 overflow-hidden" style={{ ...style, borderColor: FIELD_COLOR[f.assigned_party] }}>
                      {f.field_type === 'signature'
                        ? <img src={f.value} alt="" className="max-h-full max-w-full object-contain" />
                        : <span className="text-xs font-medium truncate px-1" style={{ fontFamily: f.field_type === 'name' ? 'var(--font-cormorant), Georgia, serif' : undefined }}>{f.value}</span>}
                    </div>
                  )
                }
                return (
                  <button
                    key={f.id}
                    disabled={!canFill(f)}
                    onClick={() => setActiveField(f)}
                    className="absolute flex items-center justify-center rounded border-2 border-dashed text-[10px] font-medium disabled:cursor-not-allowed"
                    style={{ ...style, borderColor: FIELD_COLOR[f.assigned_party], color: FIELD_COLOR[f.assigned_party], background: canFill(f) ? `${FIELD_COLOR[f.assigned_party]}14` : 'transparent' }}
                  >
                    {canFill(f) ? `Click to add ${f.field_type}` : `${f.assigned_party} ${f.field_type}`}
                  </button>
                )
              })}
            </PdfPageCanvas>
          </div>

          <Modal isOpen={!!activeField} onClose={() => setActiveField(null)} title={activeField ? `Fill ${activeField.field_type} field` : ''}>
            {activeField?.field_type === 'signature' ? (
              <SignaturePad
                defaultName={me?.full_name ?? ''}
                submitting={fieldSubmitting}
                submitLabel="Save signature"
                onSubmit={(payload) => submitFieldValue(payload.dataUrl ?? payload.name)}
              />
            ) : activeField ? (
              <FieldTextInput
                fieldType={activeField.field_type}
                defaultValue={activeField.field_type === 'date' ? new Date().toISOString().slice(0, 10) : (me?.full_name ?? '')}
                submitting={fieldSubmitting}
                onSubmit={submitFieldValue}
              />
            ) : null}
          </Modal>
        </div>
      </div>
    )
  }

  // ─── Legacy whole-document signing (documents with no placed fields) ───
  const agencySig = doc.signatures?.find((s: any) => s.party === 'agency')
  const clientSig = doc.signatures?.find((s: any) => s.party === 'client')

  const canSignAgency = isStaff && !agencySig
  const canSignClient = me && !isStaff && !clientSig

  return (
    <div className="min-h-screen bg-paper-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>

        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-display" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{doc.title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{doc.client?.company_name}</p>
          </div>
          <span className={`badge ${statusColor(doc.status)}`}>{statusLabel(doc.status)}</span>
        </div>

        {/* Document preview — a signature stamp strip overlays the bottom so it's
            clear where each party's signature actually lands, live as you sign. */}
        <div className="card overflow-hidden mb-5 relative" style={{ height: 600 }}>
          <iframe src={doc.file_url} title={doc.title} className="w-full h-full border-0" />
          <div className="absolute left-0 right-0 bottom-0 grid grid-cols-2 border-t border-sand-300 bg-white/95 backdrop-blur-sm text-xs">
            <div className="px-3 py-2 border-r border-sand-200">
              <p className="text-[10px] uppercase tracking-wider text-taupe-500 mb-1">Agency signs here</p>
              {agencySig ? (
                <div className="flex items-center gap-2">
                  {agencySig.signature_data && <img src={agencySig.signature_data} alt="" className="h-8" />}
                  <span className="text-umber-700 font-medium" style={agencySig.signature_data ? {} : { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 16 }}>{agencySig.signer_name}</span>
                </div>
              ) : signingParty === 'agency' && (live.name || live.dataUrl) ? (
                <div className="flex items-center gap-2 opacity-60">
                  {live.dataUrl && <img src={live.dataUrl} alt="" className="h-8" />}
                  <span className="text-umber-700" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 16 }}>{live.name}</span>
                </div>
              ) : (
                <span className="text-taupe-400">Unsigned</span>
              )}
            </div>
            <div className="px-3 py-2">
              <p className="text-[10px] uppercase tracking-wider text-taupe-500 mb-1">Client signs here</p>
              {clientSig ? (
                <div className="flex items-center gap-2">
                  {clientSig.signature_data && <img src={clientSig.signature_data} alt="" className="h-8" />}
                  <span className="text-umber-700 font-medium" style={clientSig.signature_data ? {} : { fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 16 }}>{clientSig.signer_name}</span>
                </div>
              ) : signingParty === 'client' && (live.name || live.dataUrl) ? (
                <div className="flex items-center gap-2 opacity-60">
                  {live.dataUrl && <img src={live.dataUrl} alt="" className="h-8" />}
                  <span className="text-umber-700" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 16 }}>{live.name}</span>
                </div>
              ) : (
                <span className="text-taupe-400">Unsigned</span>
              )}
            </div>
          </div>
        </div>

        {/* Signature status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              {agencySig ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-gray-300" />}
              <span className="font-semibold text-sm">Agency</span>
            </div>
            {agencySig ? (
              <div>
                {agencySig.signature_data && <img src={agencySig.signature_data} alt="Agency signature" className="h-12 mb-1" />}
                <p className="text-xs text-gray-500">Signed by {agencySig.signer_name} · {formatDate(agencySig.signed_at)}</p>
              </div>
            ) : canSignAgency ? (
              <button className="btn-primary btn-sm" onClick={() => { setSigningParty('agency'); setLive({ name: '', dataUrl: null }) }}>Sign as Agency</button>
            ) : (
              <p className="text-xs text-gray-400">Awaiting signature</p>
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-2 mb-2">
              {clientSig ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Circle className="w-4 h-4 text-gray-300" />}
              <span className="font-semibold text-sm">Client</span>
            </div>
            {clientSig ? (
              <div>
                {clientSig.signature_data && <img src={clientSig.signature_data} alt="Client signature" className="h-12 mb-1" />}
                <p className="text-xs text-gray-500">Signed by {clientSig.signer_name} · {formatDate(clientSig.signed_at)}</p>
              </div>
            ) : canSignClient ? (
              <button className="btn-primary btn-sm" onClick={() => { setSigningParty('client'); setLive({ name: '', dataUrl: null }) }}>Sign as Client</button>
            ) : (
              <p className="text-xs text-gray-400">Awaiting signature</p>
            )}
          </div>
        </div>

        {signingParty && (
          <div className="card p-5">
            <h3 className="mb-3">Sign as {signingParty === 'agency' ? 'Agency' : 'Client'}</h3>
            <p className="text-xs text-taupe-500 mb-3">
              Watch the {signingParty === 'agency' ? 'left' : 'right'} side of the document preview above — that&apos;s exactly where this signature will be stamped.
            </p>
            <SignaturePad
              defaultName={me?.full_name ?? ''}
              submitting={submitting}
              onSubmit={(payload) => submitSignature(signingParty, payload)}
              onLiveChange={setLive}
              submitLabel="Confirm Signature"
            />
            <button className="btn-ghost btn-sm mt-2" onClick={() => { setSigningParty(null); setLive({ name: '', dataUrl: null }) }}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}

function FieldTextInput({ fieldType, defaultValue, submitting, onSubmit }: {
  fieldType: 'name' | 'date'
  defaultValue: string
  submitting: boolean
  onSubmit: (value: string) => void
}) {
  const [value, setValue] = useState(defaultValue)
  return (
    <div className="space-y-3">
      <input
        type={fieldType === 'date' ? 'date' : 'text'}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={fieldType === 'name' ? 'Full name' : undefined}
      />
      <button className="btn-primary w-full justify-center" disabled={!value.trim() || submitting} onClick={() => onSubmit(value.trim())}>
        Save
      </button>
    </div>
  )
}
