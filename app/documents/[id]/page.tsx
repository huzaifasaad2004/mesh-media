'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react'
import SignaturePad from '@/components/esign/SignaturePad'
import { useToast } from '@/components/ui/Toast'
import { formatDate, statusColor, statusLabel } from '@/lib/utils'

const STAFF_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer']

export default function DocumentSignerPage() {
  const { id } = useParams<{ id: string }>()
  const [me, setMe] = useState<{ role: string; full_name: string | null } | null>(null)
  const [doc, setDoc] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [signingParty, setSigningParty] = useState<'agency' | 'client' | null>(null)
  const [submitting, setSubmitting] = useState(false)
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

        {/* Document preview */}
        <div className="card overflow-hidden mb-5" style={{ height: 600 }}>
          <iframe src={doc.file_url} title={doc.title} className="w-full h-full border-0" />
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
              <button className="btn-primary btn-sm" onClick={() => setSigningParty('agency')}>Sign as Agency</button>
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
              <button className="btn-primary btn-sm" onClick={() => setSigningParty('client')}>Sign as Client</button>
            ) : (
              <p className="text-xs text-gray-400">Awaiting signature</p>
            )}
          </div>
        </div>

        {signingParty && (
          <div className="card p-5">
            <h3 className="mb-3">Sign as {signingParty === 'agency' ? 'Agency' : 'Client'}</h3>
            <SignaturePad
              defaultName={me?.full_name ?? ''}
              submitting={submitting}
              onSubmit={(payload) => submitSignature(signingParty, payload)}
              submitLabel="Confirm Signature"
            />
            <button className="btn-ghost btn-sm mt-2" onClick={() => setSigningParty(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  )
}
