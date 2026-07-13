'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, DollarSign, Upload, FileText, Loader2, Eye, Download, KeyRound } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import ContractorPaymentsModal from '@/components/finance/ContractorPaymentsModal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const toast = useToast()

  const [contractor, setContractor] = useState<any>(null)
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isStaffView, setIsStaffView] = useState(false)
  const [showPayments, setShowPayments] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [password, setPassword] = useState('')
  const [settingPassword, setSettingPassword] = useState(false)
  const [passwordSet, setPasswordSet] = useState(false)

  const load = useCallback(async () => {
    try {
      if (token) {
        const res = await fetch(`/api/contractors/${id}/public?token=${token}`)
        const d = await res.json()
        if (!res.ok) throw new Error(d.error ?? 'Failed to load')
        setContractor(d)
        setIsStaffView(false)
      } else {
        const [cRes, pRes] = await Promise.all([fetch(`/api/contractors/${id}`), fetch('/api/projects')])
        const d = await cRes.json()
        if (!cRes.ok) throw new Error(d.error ?? 'Failed to load')
        setContractor(d)
        setIsStaffView(true)
        const pData = await pRes.json().catch(() => [])
        setProjects(Array.isArray(pData) ? pData.map((p: any) => ({ id: p.id, name: p.name })) : [])
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [id, token])

  useEffect(() => { load() }, [load])

  const totals = (contractor?.payments ?? []).reduce((acc: Record<string, number>, p: any) => {
    const c = p.currency ?? 'AED'
    acc[c] = (acc[c] ?? 0) + Number(p.amount)
    return acc
  }, {})

  const uploadFile = async (file: File) => {
    setUploading(true)
    try {
      const file_base64 = await fileToBase64(file)
      const res = await fetch(`/api/contractors/${id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_base64, file_name: file.name, mime_type: file.type, token: token || undefined }),
      })
      const d = await res.json()
      if (res.ok) { toast.success('File uploaded'); load() }
      else toast.error(d.error ?? 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>
  if (error || !contractor) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm" style={{ color: 'var(--danger, #B23A2E)' }}>{error || 'Not found'}</p>
    </div>
  )

  const receiptHref = (paymentId: string) => token ? `/receipt/${paymentId}?token=${token}` : `/receipt/${paymentId}`

  const setLoginPassword = async () => {
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setSettingPassword(true)
    const res = await fetch(`/api/contractors/${id}/set-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const d = await res.json()
    setSettingPassword(false)
    if (res.ok) { toast.success('Password set — you can now log in anytime at the login page'); setPasswordSet(true); setPassword('') }
    else toast.error(d.error ?? 'Failed to set password')
  }

  const content = (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      {isStaffView && (
        <Link href="/contractors" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Contractors
        </Link>
      )}

      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-display" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>{contractor.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{contractor.email ?? contractor.phone ?? ''}</p>
        </div>
        {isStaffView && (
          <button className="btn-primary" onClick={() => setShowPayments(true)}>
            <DollarSign className="w-4 h-4" /> Record Payment
          </button>
        )}
      </div>

      {!isStaffView && !contractor.has_login && (
        <div className="card p-5 mb-5">
          {passwordSet ? (
            <p className="text-sm" style={{ color: 'var(--success, #2E7D32)' }}>
              Password set! You can log in anytime with {contractor.email} at the login page — this link will still work too.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-1.5">
                <KeyRound className="w-4 h-4 text-taupe-500" />
                <h3>Set a password to log in anytime</h3>
              </div>
              <p className="text-xs text-taupe-500 mb-3">
                Optional — this link works on its own too. Setting a password lets you log in normally with {contractor.email || 'your email'} instead of keeping track of this link.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  className="flex-1 border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose"
                  placeholder="Choose a password (min. 8 characters)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button className="btn-primary btn-sm flex-shrink-0" onClick={setLoginPassword} disabled={settingPassword}>
                  {settingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Set Password
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card p-5 mb-5">
        <p className="text-xs uppercase tracking-wide text-taupe-500 mb-1">Total Paid</p>
        <p className="text-2xl font-display" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
          {Object.keys(totals).length > 0 ? Object.entries(totals).map(([c, t]) => formatCurrency(t as number, c)).join(' + ') : '—'}
        </p>
      </div>

      <div className="card p-5 mb-5">
        <h3 className="mb-3">Payment History</h3>
        {(contractor.payments ?? []).length === 0 ? (
          <p className="text-sm text-taupe-500">No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {contractor.payments.map((p: any) => (
              <div key={p.id} className="flex items-center gap-2 border border-sand-200 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink">{formatDate(p.payment_date)}</p>
                  <p className="text-xs text-taupe-500 truncate">{p.description ?? p.project?.name ?? '—'}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(p.amount, p.currency)}</span>
                <a href={receiptHref(p.id)} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" title="View receipt">
                  <Eye className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3>Project Files</h3>
          <button className="btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
          </button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])} />
        </div>
        {(contractor.files ?? []).length === 0 ? (
          <p className="text-sm text-taupe-500">No files uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {contractor.files.map((f: any) => (
              <div key={f.id} className="flex items-center gap-2 border border-sand-200 rounded-lg px-3 py-2.5">
                <FileText className="w-4 h-4 text-taupe-400 flex-shrink-0" />
                <span className="flex-1 min-w-0 truncate text-sm">{f.name}</span>
                <span className="text-xs text-taupe-400">{formatDate(f.created_at)}</span>
                <a href={f.drive_url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {isStaffView && (
        <Modal isOpen={showPayments} onClose={() => setShowPayments(false)} title={`Payments · ${contractor.name}`}>
          <ContractorPaymentsModal
            contractorId={contractor.id}
            payments={contractor.payments ?? []}
            projects={projects}
            onChanged={() => { load(); }}
          />
        </Modal>
      )}
    </div>
  )

  return <div className="min-h-screen bg-paper-0">{content}</div>
}
