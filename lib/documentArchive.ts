import { createHash } from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ArchiveEntity = 'invoice' | 'quotation' | 'agency_document'

const safePart = (value: string) => value
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9._ -]+/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, 90)

export function archiveFileName(documentNumber: string, clientName?: string | null) {
  const number = safePart(documentNumber) || 'Document'
  const client = safePart(clientName ?? '')
  return `${number}${client ? ` - ${client}` : ''}.pdf`
}

export async function archivePdf(db: SupabaseClient, input: {
  entityType: ArchiveEntity
  entityId: string
  documentNumber: string
  clientName?: string | null
  pdf: Buffer
  generatedBy?: string | null
}) {
  const fileName = archiveFileName(input.documentNumber, input.clientName)
  const storagePath = `${input.entityType}/${input.entityId}/${fileName}`
  const sha256 = createHash('sha256').update(input.pdf).digest('hex')

  const { error: uploadError } = await db.storage
    .from('document-archive')
    .upload(storagePath, input.pdf, {
      contentType: 'application/pdf',
      cacheControl: '0',
      upsert: true,
    })
  if (uploadError) throw uploadError

  const { error: rowError } = await db.from('document_archives').upsert({
    entity_type: input.entityType,
    entity_id: input.entityId,
    document_number: input.documentNumber,
    client_name: input.clientName || null,
    file_name: fileName,
    storage_path: storagePath,
    sha256,
    generated_at: new Date().toISOString(),
    generated_by: input.generatedBy || null,
  }, { onConflict: 'entity_type,entity_id' })
  if (rowError) throw rowError

  return { fileName, storagePath, sha256 }
}

export async function archivePdfBestEffort(db: SupabaseClient, input: Parameters<typeof archivePdf>[1]) {
  try {
    return await archivePdf(db, input)
  } catch (error) {
    // Archiving must never block a client download/email if storage has a transient issue.
    console.error(`[document-archive] Failed to archive ${input.entityType} ${input.entityId}:`, error)
    return null
  }
}
