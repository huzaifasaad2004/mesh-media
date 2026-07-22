import type { AgencyDocumentData, AgencyDocumentStatus, AgencyDocumentType, DocumentBlock, DocumentBlockType } from './types'

const documentTypes: AgencyDocumentType[] = ['letter', 'proposal', 'plan', 'scope', 'report']
const statuses: AgencyDocumentStatus[] = ['draft', 'review', 'approved', 'sent', 'archived']
const blockTypes: DocumentBlockType[] = ['paragraph', 'heading', 'bullet', 'numbered']

const clean = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : ''

export function normalizeBlocks(value: unknown): DocumentBlock[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 250).map((raw: any, index) => ({
    id: clean(raw?.id, 80) || `block-${index}`,
    type: blockTypes.includes(raw?.type) ? raw.type : 'paragraph',
    text: clean(raw?.text, 10000),
    bold: Boolean(raw?.bold),
    italic: Boolean(raw?.italic),
    align: ['left', 'center', 'right'].includes(raw?.align) ? raw.align : 'left',
  }))
}

export function normalizeAgencyDocument(value: any): Omit<AgencyDocumentData, 'id'> {
  const title = clean(value?.title, 180)
  const subject = clean(value?.subject, 300)
  if (!title) throw new Error('Document title is required')
  if (!subject) throw new Error('Subject is required')
  return {
    document_type: documentTypes.includes(value?.document_type) ? value.document_type : 'letter',
    title,
    status: statuses.includes(value?.status) ? value.status : 'draft',
    client_id: clean(value?.client_id, 80) || null,
    recipient_name: clean(value?.recipient_name, 180) || null,
    recipient_title: clean(value?.recipient_title, 180) || null,
    company_name: clean(value?.company_name, 180) || null,
    address_line: clean(value?.address_line, 400) || null,
    subject,
    salutation_name: clean(value?.salutation_name, 180) || null,
    content: normalizeBlocks(value?.content),
    closing: clean(value?.closing, 180) || 'Warm regards,',
    signatory_name: clean(value?.signatory_name, 180) || 'Huzaifa Bin Saad',
    signatory_role: clean(value?.signatory_role, 240) || 'FOUNDER · MESHMEDIA FOR MARKETING AND PR',
  }
}

export function safeDownloadName(value: string, extension: 'pdf' | 'docx') {
  const name = value.normalize('NFKD').replace(/[^a-zA-Z0-9._ -]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 100) || 'MeshMedia Document'
  return `${name}.${extension}`
}
