'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, Download, FileText, Loader2, Plus, Trash2 } from 'lucide-react'
import EmptyState from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/utils'

const statusStyle: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  review: 'bg-amber-50 text-amber-700',
  approved: 'bg-green-50 text-green-700',
  sent: 'bg-blue-50 text-blue-700',
  archived: 'bg-gray-100 text-gray-500',
}

export default function DocumentStudioPage() {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const load = useCallback(async () => {
    const res = await fetch('/api/agency-documents')
    const data = await res.json()
    setDocuments(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const duplicate = async (document: any) => {
    const res = await fetch('/api/agency-documents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...document, id: undefined, title: `${document.title} — Copy`, status: 'draft' }),
    })
    if (res.ok) { toast.success('Document duplicated'); load() }
    else toast.error('Could not duplicate document')
  }
  const remove = async (id: string) => {
    if (!confirm('Delete this draft document?')) return
    const res = await fetch(`/api/agency-documents/${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Document deleted'); load() }
    else toast.error('Could not delete document')
  }

  return (
    <div>
      <div className="page-header">
        <div><h1>Document Studio</h1><p className="text-gray-500 text-sm mt-0.5">Branded proposals, plans, letters and reports</p></div>
        <Link href="/documents/studio/new" className="btn-primary"><Plus className="w-4 h-4" /> New Document</Link>
      </div>
      <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50/50 px-4 py-3 flex items-start gap-3">
        <FileText className="w-5 h-5 text-brand-600 mt-0.5" />
        <div><p className="text-sm font-medium text-gray-900">Official MeshMedia letterhead is built in</p><p className="text-xs text-gray-600 mt-0.5">Create once, then download a faithful Word file or production-safe PDF. Generated files are archived automatically.</p></div>
      </div>
      <div className="card overflow-hidden">
        {loading ? <div className="py-20 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div> : documents.length ? (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Document</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Client</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th><th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Updated</th><th className="px-5 py-3" /></tr></thead>
          <tbody className="divide-y divide-gray-50">{documents.map((document) => <tr key={document.id} className="table-row"><td className="px-5 py-3"><Link href={`/documents/studio/${document.id}`} className="font-medium text-gray-900 hover:text-brand-600">{document.title}</Link><p className="text-xs text-gray-400 capitalize mt-0.5">{document.document_type}</p></td><td className="px-5 py-3 text-gray-600">{document.company_name || document.client?.company_name || '—'}</td><td className="px-5 py-3"><span className={`badge capitalize ${statusStyle[document.status] || statusStyle.draft}`}>{document.status}</span></td><td className="px-5 py-3 text-xs text-gray-500">{formatDate(document.updated_at)}</td><td className="px-5 py-3"><div className="flex justify-end gap-1"><a href={`/api/agency-documents/${document.id}/pdf`} className="p-2 rounded hover:bg-gray-100 text-gray-500" title="Download PDF"><Download className="w-3.5 h-3.5" /></a><button onClick={() => duplicate(document)} className="p-2 rounded hover:bg-gray-100 text-gray-500" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button><button onClick={() => remove(document.id)} className="p-2 rounded hover:bg-red-50 text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button></div></td></tr>)}</tbody></table></div>
        ) : <EmptyState icon={FileText} title="No studio documents yet" helper="Create a branded proposal, plan, letter or report without opening Word." action={<Link href="/documents/studio/new" className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" /> New Document</Link>} />}
      </div>
    </div>
  )
}
