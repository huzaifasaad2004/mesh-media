import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireDocumentsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { isStaff } from '@/lib/roles'
import { SAFE_RECIPIENT_COLUMNS, pickViewerRecipient } from '@/lib/signableDocuments'

// RLS-scoped: staff see all, client-portal users only their own. `viewer` is the recipient
// the caller signs as (see pickViewerRecipient).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res

  const { data, error } = await auth.db
    .from('signable_documents')
    .select(`*, client:clients(company_name, email, contact_person), signatures:document_signatures(*), fields:document_fields(*), recipients:document_recipients(${SAFE_RECIPIENT_COLUMNS})`)
    .eq('id', params.id)
    .single()
  if (error || !data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  // document_recipients is staff-only under RLS, so a client opening their own document
  // (already authorized by the read above) got no recipients back — the page then couldn't
  // tell which boxes were theirs and every field stayed locked.
  const staff = isStaff(auth.role)
  if (!staff) {
    const { data: recipients } = await serviceRole().from('document_recipients')
      .select(SAFE_RECIPIENT_COLUMNS).eq('document_id', params.id).order('created_at')
    data.recipients = recipients ?? []
  }
  const { data: profile } = await auth.db.from('profiles').select('email').eq('id', auth.user.id).single()
  const viewer = pickViewerRecipient(data.recipients ?? [], {
    email: profile?.email ?? auth.user.email, isStaff: staff, isClient: auth.role === 'client',
  })
  return NextResponse.json({ ...data, viewer })
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
