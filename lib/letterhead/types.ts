export type AgencyDocumentType = 'letter' | 'proposal' | 'plan' | 'scope' | 'report'
export type AgencyDocumentStatus = 'draft' | 'review' | 'approved' | 'sent' | 'archived'
export type DocumentBlockType = 'paragraph' | 'heading' | 'bullet' | 'numbered'

export interface DocumentBlock {
  id: string
  type: DocumentBlockType
  text: string
  bold?: boolean
  italic?: boolean
  align?: 'left' | 'center' | 'right'
}

export interface AgencyDocumentData {
  id: string
  document_type: AgencyDocumentType
  title: string
  status: AgencyDocumentStatus
  client_id?: string | null
  recipient_name?: string | null
  recipient_title?: string | null
  company_name?: string | null
  address_line?: string | null
  subject: string
  salutation_name?: string | null
  content: DocumentBlock[]
  closing: string
  signatory_name: string
  signatory_role: string
  created_at?: string
  updated_at?: string
  created_by?: string | null
}

export const EMPTY_BLOCKS: DocumentBlock[] = [
  { id: 'opening', type: 'paragraph', text: '' },
  { id: 'body', type: 'paragraph', text: '' },
  { id: 'closing', type: 'paragraph', text: '' },
]
