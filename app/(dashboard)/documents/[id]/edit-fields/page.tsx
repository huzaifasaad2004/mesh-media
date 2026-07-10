'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2, Loader2, Save, ChevronLeft, ChevronRight } from 'lucide-react'
import PdfPageCanvas from '@/components/esign/PdfPageCanvas'
import { useToast } from '@/components/ui/Toast'

type FieldType = 'signature' | 'name' | 'date'

interface Recipient { id: string; name: string; email: string; role: string }

interface DraftField {
  id: string // client-side temp id, or the real db id if loaded
  page_number: number
  field_type: FieldType
  recipient_id: string
  x: number; y: number; width: number; height: number
}

const DEFAULT_SIZE: Record<FieldType, { width: number; height: number }> = {
  signature: { width: 0.22, height: 0.06 },
  name: { width: 0.2, height: 0.035 },
  date: { width: 0.14, height: 0.035 },
}

const PALETTE = ['#6E1318', '#4A5A6E', '#B8801F', '#4F7A4A', '#7A4A6E', '#2A6E6E']

export default function EditFieldsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const [doc, setDoc] = useState<any>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [page, setPage] = useState(1)
  const [numPages, setNumPages] = useState(1)
  const [renderSize, setRenderSize] = useState({ width: 0, height: 0 })
  const [fields, setFields] = useState<DraftField[]>([])
  const [fieldType, setFieldType] = useState<FieldType>('signature')
  const [recipientId, setRecipientId] = useState('')
  const dragStart = useRef<{ x: number; y: number } | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [dragBox, setDragBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  const colorFor = useMemo(() => {
    const map = new Map<string, string>()
    recipients.forEach((r, i) => map.set(r.id, PALETTE[i % PALETTE.length]))
    return (rid: string) => map.get(rid) ?? '#6E1318'
  }, [recipients])

  useEffect(() => {
    (async () => {
      const [docRes, fieldsRes] = await Promise.all([fetch(`/api/documents/${id}`), fetch(`/api/documents/${id}/fields`)])
      const docData = await docRes.json()
      const fieldsData = await fieldsRes.json()
      if (docRes.ok) {
        setDoc(docData)
        setRecipients(docData.recipients ?? [])
        if (docData.recipients?.length) setRecipientId(docData.recipients[0].id)
      }
      if (fieldsRes.ok && Array.isArray(fieldsData)) {
        setFields(fieldsData.filter((f: any) => f.recipient_id).map((f: any) => ({
          id: f.id, page_number: f.page_number, field_type: f.field_type, recipient_id: f.recipient_id,
          x: Number(f.x), y: Number(f.y), width: Number(f.width), height: Number(f.height),
        })))
      }
      setLoading(false)
    })()
  }, [id])

  const pageFields = fields.filter((f) => f.page_number === page)

  const relativePos = useCallback((clientX: number, clientY: number) => {
    const rect = overlayRef.current!.getBoundingClientRect()
    return {
      x: Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((clientY - rect.top) / rect.height, 0), 1),
    }
  }, [])

  const onMouseDown = (e: React.MouseEvent) => {
    if (!overlayRef.current || !recipientId) return
    const pos = relativePos(e.clientX, e.clientY)
    dragStart.current = pos
    setDragBox({ x: pos.x, y: pos.y, w: 0, h: 0 })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart.current) return
    const pos = relativePos(e.clientX, e.clientY)
    setDragBox({
      x: Math.min(dragStart.current.x, pos.x),
      y: Math.min(dragStart.current.y, pos.y),
      w: Math.abs(pos.x - dragStart.current.x),
      h: Math.abs(pos.y - dragStart.current.y),
    })
  }

  const onMouseUp = () => {
    if (!dragStart.current || !dragBox || !recipientId) { dragStart.current = null; return }
    const useDefault = dragBox.w < 0.02 || dragBox.h < 0.01
    const size = DEFAULT_SIZE[fieldType]
    const newField: DraftField = {
      id: `tmp-${Date.now()}`,
      page_number: page,
      field_type: fieldType,
      recipient_id: recipientId,
      x: dragBox.x,
      y: dragBox.y,
      width: useDefault ? size.width : dragBox.w,
      height: useDefault ? size.height : dragBox.h,
    }
    setFields((prev) => [...prev, newField])
    dragStart.current = null
    setDragBox(null)
  }

  const removeField = (fieldId: string) => setFields((prev) => prev.filter((f) => f.id !== fieldId))

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/documents/${id}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: fields.map(({ page_number, field_type, recipient_id, x, y, width, height }) => ({ page_number, field_type, recipient_id, x, y, width, height })) }),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) { toast.success('Fields saved'); router.push(`/documents/${id}`) }
    else toast.error(d.error ?? 'Failed to save fields')
  }

  if (loading) return <div className="py-24 text-center text-gray-400 text-sm">Loading…</div>
  if (!doc) return <div className="py-24 text-center text-sm" style={{ color: 'var(--danger, #B23A2E)' }}>Document not found</div>
  if (recipients.length === 0) return (
    <div className="py-24 text-center text-sm text-taupe-500">
      This document has no recipients yet.<br />
      <Link href="/documents" className="text-brand-600 hover:underline">Delete it and re-upload with recipients added.</Link>
    </div>
  )

  return (
    <div>
      <Link href="/documents" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Documents
      </Link>

      <div className="page-header">
        <div>
          <h1>Place signature fields</h1>
          <p className="text-gray-500 text-sm mt-0.5">{doc.title} — drag on the document to drop a field, then save.</p>
        </div>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save fields
        </button>
      </div>

      <div className="flex flex-wrap gap-4 mb-4 items-center">
        <div className="flex gap-1.5 text-xs">
          {(['signature', 'name', 'date'] as FieldType[]).map((t) => (
            <button key={t} onClick={() => setFieldType(t)} className={`px-3 py-1.5 rounded-md capitalize ${fieldType === t ? 'bg-maroon text-white' : 'bg-paper-100 text-umber-700'}`}>{t}</button>
          ))}
        </div>
        <div className="flex gap-1.5 text-xs flex-wrap">
          {recipients.map((r) => (
            <button
              key={r.id}
              onClick={() => setRecipientId(r.id)}
              className={`px-3 py-1.5 rounded-md ${recipientId === r.id ? 'text-white' : 'bg-paper-100 text-umber-700'}`}
              style={recipientId === r.id ? { background: colorFor(r.id) } : {}}
            >
              {r.name}
            </button>
          ))}
        </div>
        {numPages > 1 && (
          <div className="flex items-center gap-2 text-xs ml-auto">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm"><ChevronLeft className="w-3 h-3" /></button>
            <span>Page {page} / {numPages}</span>
            <button onClick={() => setPage((p) => Math.min(numPages, p + 1))} disabled={page === numPages} className="btn-secondary btn-sm"><ChevronRight className="w-3 h-3" /></button>
          </div>
        )}
      </div>

      <div className="flex gap-6 flex-wrap items-start">
        <div
          ref={overlayRef}
          className="relative select-none cursor-crosshair"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
        >
          <PdfPageCanvas
            fileUrl={doc.file_url}
            pageNumber={page}
            width={700}
            onDocumentLoad={setNumPages}
            onPageRender={setRenderSize}
          >
            {pageFields.map((f) => {
              const recipient = recipients.find((r) => r.id === f.recipient_id)
              return (
                <div
                  key={f.id}
                  className="absolute flex items-center justify-center text-[10px] font-medium text-white rounded"
                  style={{
                    left: f.x * renderSize.width, top: f.y * renderSize.height,
                    width: f.width * renderSize.width, height: f.height * renderSize.height,
                    background: `${colorFor(f.recipient_id)}CC`,
                  }}
                  title={recipient?.name}
                >
                  {f.field_type}
                  <button onClick={(e) => { e.stopPropagation(); removeField(f.id) }} className="absolute -top-2 -right-2 w-4 h-4 bg-white rounded-full flex items-center justify-center text-red-600 shadow">
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              )
            })}
            {dragBox && (
              <div
                className="absolute border-2 border-dashed rounded pointer-events-none"
                style={{
                  left: dragBox.x * renderSize.width, top: dragBox.y * renderSize.height,
                  width: dragBox.w * renderSize.width, height: dragBox.h * renderSize.height,
                  borderColor: colorFor(recipientId),
                }}
              />
            )}
          </PdfPageCanvas>
        </div>

        <div className="card p-4 w-full max-w-xs">
          <h3 className="mb-2">Fields ({fields.length})</h3>
          {fields.length === 0 ? (
            <p className="text-xs text-taupe-500">Pick a recipient above, then click and drag on the document to place a field.</p>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {fields.map((f) => {
                const recipient = recipients.find((r) => r.id === f.recipient_id)
                return (
                  <li key={f.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded bg-paper-50">
                    <span className="capitalize">{f.field_type} · {recipient?.name ?? '—'} · p{f.page_number}</span>
                    <button onClick={() => removeField(f.id)} className="text-gray-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
