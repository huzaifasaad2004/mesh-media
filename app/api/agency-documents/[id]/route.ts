import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, requireDocumentsWrite } from '@/lib/apiAuth'
import { normalizeAgencyDocument } from '@/lib/letterhead/validation'
import { logActivity } from '@/lib/activityLog'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db.from('agency_documents').select('*').eq('id', params.id).single()
  if (error || !data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res
  try {
    const body = normalizeAgencyDocument(await req.json())
    const { data, error } = await auth.db.from('agency_documents').update({
      ...body,
      updated_at: new Date().toISOString(),
    }).eq('id', params.id).select('*').single()
    if (error || !data) return NextResponse.json({ error: error?.message || 'Document not found' }, { status: 400 })
    await logActivity(auth.user, 'update', 'agency_document', data.id, data.title)
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid document' }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db.from('agency_documents').delete().eq('id', params.id).select('id, title').single()
  if (error || !data) return NextResponse.json({ error: error?.message || 'Document not found' }, { status: 400 })
  await logActivity(auth.user, 'delete', 'agency_document', data.id, data.title)
  return NextResponse.json({ success: true })
}
