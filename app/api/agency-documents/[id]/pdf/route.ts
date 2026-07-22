import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { renderLetterheadPdf } from '@/lib/pdf/LetterheadPdf'
import { archivePdfBestEffort } from '@/lib/documentArchive'
import { safeDownloadName } from '@/lib/letterhead/validation'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db.from('agency_documents').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const pdf = await renderLetterheadPdf(data)
  const archived = await archivePdfBestEffort(serviceRole(), {
    entityType: 'agency_document',
    entityId: data.id,
    documentNumber: data.title,
    clientName: data.company_name,
    pdf: Buffer.from(pdf),
    generatedBy: auth.user.id,
  })
  if (archived) {
    await serviceRole().from('agency_documents').update({ pdf_storage_path: archived.storagePath }).eq('id', data.id)
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeDownloadName(data.title, 'pdf')}"`,
      'Cache-Control': 'no-store',
    },
  })
}
