'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlignCenter, AlignLeft, AlignRight, ArrowLeft, Bold, Download, FileText, GripVertical, Italic, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import type { AgencyDocumentData, DocumentBlock, DocumentBlockType } from '@/lib/letterhead/types'
import { EMPTY_BLOCKS } from '@/lib/letterhead/types'

const inputClass = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent bg-white'
const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1'
const newId = () => `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

const blankDocument = (): Omit<AgencyDocumentData, 'id'> => ({
  document_type: 'letter',
  title: 'Untitled MeshMedia Document',
  status: 'draft',
  client_id: null,
  recipient_name: '',
  recipient_title: '',
  company_name: '',
  address_line: '',
  subject: '',
  salutation_name: '',
  content: EMPTY_BLOCKS.map((block) => ({ ...block, id: newId() })),
  closing: 'Warm regards,',
  signatory_name: 'Huzaifa Bin Saad',
  signatory_role: 'FOUNDER · MESHMEDIA FOR MARKETING AND PR',
})

interface ClientOption {
  id: string
  company_name: string
  contact_person?: string | null
  email?: string | null
  address?: string | null
}

export default function DocumentStudioEditor({ documentId }: { documentId?: string }) {
  const router = useRouter()
  const toast = useToast()
  const [document, setDocument] = useState<any>(blankDocument())
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(Boolean(documentId))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch('/api/clients').then((res) => res.json()),
      documentId ? fetch(`/api/agency-documents/${documentId}`).then((res) => res.json()) : Promise.resolve(null),
    ]).then(([clientData, documentData]) => {
      setClients(Array.isArray(clientData) ? clientData : [])
      if (documentData?.id) setDocument(documentData)
      setLoading(false)
    })
  }, [documentId])

  const update = (patch: Record<string, unknown>) => setDocument((current: any) => ({ ...current, ...patch }))
  const updateBlock = (id: string, patch: Partial<DocumentBlock>) => update({
    content: document.content.map((block: DocumentBlock) => block.id === id ? { ...block, ...patch } : block),
  })
  const addBlock = (type: DocumentBlockType = 'paragraph') => update({
    content: [...document.content, { id: newId(), type, text: '', align: 'left' }],
  })
  const removeBlock = (id: string) => update({ content: document.content.filter((block: DocumentBlock) => block.id !== id) })

  const chooseClient = (id: string) => {
    const client = clients.find((item) => item.id === id)
    update({
      client_id: id || null,
      company_name: client?.company_name || document.company_name,
      recipient_name: client?.contact_person || document.recipient_name,
      salutation_name: client?.contact_person?.split(' ')[0] || document.salutation_name,
      address_line: client?.address || document.address_line,
    })
  }

  const save = async () => {
    if (!document.title.trim() || !document.subject.trim()) {
      toast.error('Title and subject are required')
      return null
    }
    setSaving(true)
    try {
      const res = await fetch(documentId ? `/api/agency-documents/${documentId}` : '/api/agency-documents', {
        method: documentId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(document),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Could not save document')
        return null
      }
      setDocument(data)
      toast.success('Document saved')
      if (!documentId) router.replace(`/documents/studio/${data.id}`)
      return data.id as string
    } finally {
      setSaving(false)
    }
  }

  const download = async (format: 'pdf' | 'docx') => {
    const id = await save()
    if (!id) return
    window.location.href = `/api/agency-documents/${id}/${format}`
  }

  const previewBlocks = useMemo(() => {
    let number = 0
    return document.content.map((block: DocumentBlock) => {
      if (block.type === 'numbered') number += 1
      else number = 0
      const style = { textAlign: block.align || 'left', fontWeight: block.bold ? 700 : undefined, fontStyle: block.italic ? 'italic' : undefined } as const
      if (block.type === 'heading') return <h3 key={block.id} className="mt-4 mb-1 text-sm font-bold text-[#6E1318]" style={style}>{block.text || 'Section heading'}</h3>
      if (block.type === 'bullet') return <p key={block.id} className="mb-1 pl-4" style={style}>• {block.text}</p>
      if (block.type === 'numbered') return <p key={block.id} className="mb-1 pl-4" style={style}>{number}. {block.text}</p>
      return <p key={block.id} className="mb-2" style={style}>{block.text || 'Start writing…'}</p>
    })
  }, [document.content])

  if (loading) return <div className="py-24 text-center text-sm text-gray-400">Loading Document Studio…</div>

  return (
    <div className="pb-10">
      <div className="page-header gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <Link href="/documents/studio" className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500"><ArrowLeft className="w-4 h-4" /></Link>
          <div className="min-w-0">
            <h1 className="truncate">{document.title || 'New document'}</h1>
            <p className="text-gray-500 text-sm mt-0.5">MeshMedia letterhead · autosaved when you press Save</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => download('docx')}><Download className="w-4 h-4" /> Word</button>
          <button className="btn-secondary" onClick={() => download('pdf')}><Download className="w-4 h-4" /> PDF</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save</button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[minmax(0,1fr)_560px] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          <section className="card p-5">
            <h2 className="text-base font-semibold mb-4">Document details</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className={labelClass}>Internal title</label><input className={inputClass} value={document.title} onChange={(e) => update({ title: e.target.value })} /></div>
              <div><label className={labelClass}>Document type</label><select className={inputClass} value={document.document_type} onChange={(e) => update({ document_type: e.target.value })}><option value="letter">Letter</option><option value="proposal">Proposal</option><option value="plan">Plan</option><option value="scope">Scope of work</option><option value="report">Report</option></select></div>
              <div><label className={labelClass}>CRM client</label><select className={inputClass} value={document.client_id || ''} onChange={(e) => chooseClient(e.target.value)}><option value="">No linked client</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company_name}</option>)}</select></div>
              <div><label className={labelClass}>Status</label><select className={inputClass} value={document.status} onChange={(e) => update({ status: e.target.value })}><option value="draft">Draft</option><option value="review">In review</option><option value="approved">Approved</option><option value="sent">Sent</option><option value="archived">Archived</option></select></div>
              <div><label className={labelClass}>Recipient name</label><input className={inputClass} value={document.recipient_name || ''} onChange={(e) => update({ recipient_name: e.target.value })} /></div>
              <div><label className={labelClass}>Title / position</label><input className={inputClass} value={document.recipient_title || ''} onChange={(e) => update({ recipient_title: e.target.value })} /></div>
              <div><label className={labelClass}>Company name</label><input className={inputClass} value={document.company_name || ''} onChange={(e) => update({ company_name: e.target.value })} /></div>
              <div><label className={labelClass}>Address</label><input className={inputClass} value={document.address_line || ''} onChange={(e) => update({ address_line: e.target.value })} /></div>
              <div className="md:col-span-2"><label className={labelClass}>Subject</label><input className={inputClass} value={document.subject} onChange={(e) => update({ subject: e.target.value })} placeholder="e.g. Social Media Marketing Proposal" /></div>
              <div><label className={labelClass}>Dear…</label><input className={inputClass} value={document.salutation_name || ''} onChange={(e) => update({ salutation_name: e.target.value })} /></div>
              <div><label className={labelClass}>Closing</label><input className={inputClass} value={document.closing} onChange={(e) => update({ closing: e.target.value })} /></div>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div><h2 className="text-base font-semibold">Document body</h2><p className="text-xs text-gray-500 mt-0.5">Build clean sections without disturbing the letterhead.</p></div>
              <div className="flex gap-1"><button className="btn-secondary btn-sm" onClick={() => addBlock('paragraph')}><Plus className="w-3.5 h-3.5" /> Paragraph</button><button className="btn-secondary btn-sm" onClick={() => addBlock('heading')}><Plus className="w-3.5 h-3.5" /> Heading</button></div>
            </div>
            <div className="space-y-3">
              {document.content.map((block: DocumentBlock) => (
                <div key={block.id} className="border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                  <div className="flex items-center gap-1 mb-2 text-gray-500">
                    <GripVertical className="w-4 h-4 mr-1" />
                    <select className="text-xs border border-gray-200 rounded px-2 py-1 bg-white" value={block.type} onChange={(e) => updateBlock(block.id, { type: e.target.value as DocumentBlockType })}><option value="paragraph">Paragraph</option><option value="heading">Heading</option><option value="bullet">Bullet</option><option value="numbered">Numbered</option></select>
                    <button className={`p-1.5 rounded ${block.bold ? 'bg-brand-100 text-brand-700' : 'hover:bg-gray-100'}`} onClick={() => updateBlock(block.id, { bold: !block.bold })}><Bold className="w-3.5 h-3.5" /></button>
                    <button className={`p-1.5 rounded ${block.italic ? 'bg-brand-100 text-brand-700' : 'hover:bg-gray-100'}`} onClick={() => updateBlock(block.id, { italic: !block.italic })}><Italic className="w-3.5 h-3.5" /></button>
                    {(['left', 'center', 'right'] as const).map((align) => { const Icon = align === 'left' ? AlignLeft : align === 'center' ? AlignCenter : AlignRight; return <button key={align} className={`p-1.5 rounded ${block.align === align ? 'bg-brand-100 text-brand-700' : 'hover:bg-gray-100'}`} onClick={() => updateBlock(block.id, { align })}><Icon className="w-3.5 h-3.5" /></button> })}
                    <button className="ml-auto p-1.5 rounded hover:bg-red-50 hover:text-red-600" onClick={() => removeBlock(block.id)}><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                  <textarea className={`${inputClass} min-h-[92px] resize-y`} value={block.text} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder={block.type === 'heading' ? 'Section heading' : 'Write here…'} />
                </div>
              ))}
              {!document.content.length && <button className="w-full border-2 border-dashed border-gray-200 rounded-xl py-8 text-sm text-gray-500 hover:border-brand-300" onClick={() => addBlock()}>Add your first paragraph</button>}
            </div>
          </section>

          <section className="card p-5">
            <h2 className="text-base font-semibold mb-4">Signature block</h2>
            <div className="grid md:grid-cols-2 gap-4"><div><label className={labelClass}>Name</label><input className={inputClass} value={document.signatory_name} onChange={(e) => update({ signatory_name: e.target.value })} /></div><div><label className={labelClass}>Role</label><input className={inputClass} value={document.signatory_role} onChange={(e) => update({ signatory_role: e.target.value })} /></div></div>
          </section>
        </div>

        <aside className="xl:sticky xl:top-5">
          <div className="flex items-center gap-2 mb-2 text-xs font-medium text-gray-500"><FileText className="w-3.5 h-3.5" /> Live A4 preview</div>
          <div className="relative bg-white shadow-xl border border-gray-200 mx-auto overflow-hidden" style={{ width: '100%', aspectRatio: '210 / 297', fontFamily: 'Arial, Helvetica, sans-serif' }}>
            <div className="absolute left-[14.3%] right-[10.5%] top-[4.2%]">
              <div className="flex justify-between items-start"><img src="/templates/letterhead-assets/logo_lockup.png" alt="MeshMedia" className="w-[41%] h-auto" /><div className="text-right mt-2"><p className="text-[7px] font-bold tracking-[0.14em] text-[#6E1318]">MARKETING &amp; PUBLIC RELATIONS</p><p className="text-[6px] tracking-[0.14em] text-[#9C9384] mt-1">ABU DHABI · UNITED ARAB EMIRATES</p></div></div>
              <div className="flex items-center mt-3"><div className="h-[3px] w-[16%] bg-[#6E1318]" /><div className="h-px flex-1 bg-[#C8BCA8] ml-2" /></div>
            </div>
            <img src="/templates/letterhead-assets/ghost_mark.png" alt="" className="absolute opacity-[0.035] w-[65%] right-[-8%] top-[43%]" />
            <img src="/templates/letterhead-assets/edge_type.png" alt="" className="absolute opacity-70 w-[1.4%] left-[6.5%] top-[57%]" />
            <div className="absolute left-[14.3%] right-[10.5%] top-[15%] bottom-[12%] overflow-hidden text-[8px] leading-[1.5] text-[#151312]">
              <p className="text-[6px] tracking-[0.18em] text-[#9C9384] mb-4">{new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date()).toUpperCase()}</p>
              {document.recipient_name && <p className="font-bold">{document.recipient_name}</p>}<p className="text-[#6E655B]">{document.recipient_title}</p><p className="text-[#6E655B]">{document.company_name}</p><p className="text-[#6E655B]">{document.address_line}</p>
              <p className="text-[7px] font-bold tracking-[0.12em] text-[#6E1318] my-4">SUBJECT: {document.subject?.toUpperCase() || 'YOUR SUBJECT'}</p>
              <p className="mb-3">Dear {document.salutation_name || document.recipient_name || 'Sir/Madam'},</p>{previewBlocks}
              <p className="mt-3">{document.closing}</p><div className="mt-8 border-t border-[#6E1318] pt-2 w-[45%]"><p className="font-bold">{document.signatory_name}</p><p className="text-[6px] tracking-[0.12em] text-[#9C9384]">{document.signatory_role}</p></div>
            </div>
            <div className="absolute left-[14.3%] right-[10.5%] bottom-[3.7%] border-t border-[#C8BCA8] pt-2 text-[5px] tracking-[0.08em] text-[#9C9384]"><div className="flex justify-between"><span>MAZYAD MALL, TOWER 2, OFFICE 619</span><span>+971 50 950 1326</span><span>THEMESHMEDIA.COM</span></div><div className="flex justify-between"><span>MBZ · ABU DHABI · U.A.E.</span><span>HELLO@M3M.AE</span><span>TRADE LICENCE 1594410</span></div></div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 text-center">Preview is scaled. PDF and Word downloads use exact A4 geometry.</p>
        </aside>
      </div>
    </div>
  )
}
