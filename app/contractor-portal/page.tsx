'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Upload, FileText, Loader2, Eye, Download } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function ContractorPortalPage() {
  const toast = useToast()
  const [contractor, setContractor] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/contractor-portal/me')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Failed to load')
      setContractor(d)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totals = (contractor?.payments ?? []).reduce((acc: Record<string, number>, p: any) => {
    const c = p.currency ?? 'AED'
    acc[c] = (acc[c] ?? 0) + Number(p.amount)
    return acc
  }, {})

  const uploadFile = async (file: File) => {
    if (!contractor) return
    setUploading(true)
    try {
      const file_base64 = await fileToBase64(file)
      const res = await fetch(`/api/contractors/${contractor.id}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_base64, file_name: file.name, mime_type: file.type }),
      })
      const d = await res.json()
      if (res.ok) { toast.success('File uploaded'); load() }
      else toast.error(d.error ?? 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (loading) return <div className="py-24 text-center text-gray-400 text-sm">Loading…</div>
  if (error || !contractor) return <div className="py-24 text-center text-sm" style={{ color: 'var(--danger, #B23A2E)' }}>{error || 'Not found'}</div>

  return (
    <div>
      <h1 className="text-2xl font-display mb-6" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
        Welcome, {contractor.name}
      </h1>

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
                <a href={`/receipt/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" title="View receipt">
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
    </div>
  )
}
