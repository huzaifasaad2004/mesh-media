import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, serviceRole } from '@/lib/apiAuth'
import { renderLetterheadDocx } from '@/lib/letterhead/docx'
import { safeDownloadName } from '@/lib/letterhead/validation'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db.from('agency_documents').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const docx = await renderLetterheadDocx(data)
  const fileName = safeDownloadName(data.title, 'docx')
  const storagePath = `agency_document/${data.id}/${fileName}`
  const db = serviceRole()
  const { error: uploadError } = await db.storage.from('document-archive').upload(storagePath, docx, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    cacheControl: '0',
    upsert: true,
  })
  if (!uploadError) await db.from('agency_documents').update({ docx_storage_path: storagePath }).eq('id', data.id)
  else console.error(`[document-studio] DOCX archive failed for ${data.id}:`, uploadError)

  return new NextResponse(new Uint8Array(docx), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
