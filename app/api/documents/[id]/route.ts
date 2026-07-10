import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireDocumentsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

// RLS-scoped: staff see all, client-portal users only their own.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res

  const { data, error } = await auth.db
    .from('signable_documents')
    .select('*, client:clients(company_name, email, contact_person), signatures:document_signatures(*), fields:document_fields(*), recipients:document_recipients(id, name, email, role, signed_at, notified_at)')
    .eq('id', params.id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: existing } = await db.from('signable_documents').select('title, storage_path').eq('id', params.id).single()
  if (existing?.storage_path) {
    await db.storage.from('signable-documents').remove([existing.storage_path])
  }
  const { error } = await db.from('signable_documents').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'signable_document', params.id, existing?.title)
  return NextResponse.json({ success: true })
}
