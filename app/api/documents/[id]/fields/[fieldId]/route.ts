import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { isStaff } from '@/lib/roles'
import { notifyUsers } from '@/lib/notify'
import { mergeFieldsIntoPdf } from '@/lib/pdf/mergeDocument'

// Body: { value } — base64 PNG data URL for a signature field, plain text for name/date.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { user, role } = auth

  const { value } = await req.json()
  if (!value?.toString().trim()) return NextResponse.json({ error: 'value is required' }, { status: 400 })

  const db = serviceRole()
  const { data: document, error: docError } = await db.from('signable_documents')
    .select('id, client_id, status, file_url, storage_path')
    .eq('id', params.id).single()
  if (docError || !document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (document.status === 'cancelled') return NextResponse.json({ error: 'This document was cancelled' }, { status: 400 })

  const { data: field, error: fieldError } = await db.from('document_fields')
    .select('*').eq('id', params.fieldId).eq('document_id', params.id).single()
  if (fieldError || !field) return NextResponse.json({ error: 'Field not found' }, { status: 404 })

  if (field.assigned_party === 'agency') {
    if (!isStaff(role)) return NextResponse.json({ error: 'Only staff can fill an agency field' }, { status: 403 })
  } else {
    const { data: link } = await db.from('client_contacts').select('client_id').eq('user_id', user.id).eq('client_id', document.client_id).maybeSingle()
    if (!link) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
  }

  const { error: updateError } = await db.from('document_fields').update({
    value: value.toString(),
    filled_at: new Date().toISOString(),
    filled_by: user.id,
  }).eq('id', params.fieldId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  await logActivity(user, 'sign', 'signable_document', params.id, `${field.assigned_party} filled a ${field.field_type} field`)

  const { data: allFields } = await db.from('document_fields').select('*').eq('document_id', params.id)
  const remaining = (allFields ?? []).filter((f) => !f.value)
  const parties = new Set((allFields ?? []).map((f) => f.assigned_party))
  const filledParties = new Set((allFields ?? []).filter((f) => f.value).map((f) => f.assigned_party))

  let newStatus = document.status
  let mergeError: string | null = null

  if (remaining.length === 0 && (allFields?.length ?? 0) > 0) {
    // Every field is filled — stamp them onto the real PDF and store the merged, flattened copy.
    try {
      const sourceRes = await fetch(document.file_url)
      const originalBytes = new Uint8Array(await sourceRes.arrayBuffer())
      const mergedBytes = await mergeFieldsIntoPdf(originalBytes, allFields!.map((f) => ({
        page_number: f.page_number, field_type: f.field_type, x: Number(f.x), y: Number(f.y),
        width: Number(f.width), height: Number(f.height), value: f.value,
      })))
      const mergedPath = (document.storage_path ?? `${document.client_id}/${params.id}`).replace(/\.pdf$/i, '') + '-signed.pdf'
      const { error: uploadError } = await db.storage.from('signable-documents').upload(mergedPath, Buffer.from(mergedBytes), { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: publicUrl } = db.storage.from('signable-documents').getPublicUrl(mergedPath)
      newStatus = 'signed'
      await db.from('signable_documents').update({ status: newStatus, merged_file_url: publicUrl.publicUrl }).eq('id', params.id)
    } catch (e: any) {
      mergeError = e.message
      newStatus = 'partially_signed'
      await db.from('signable_documents').update({ status: newStatus }).eq('id', params.id)
    }
  } else {
    newStatus = filledParties.size > 0 && filledParties.size < parties.size ? 'partially_signed' : document.status
    if (newStatus !== document.status) await db.from('signable_documents').update({ status: newStatus }).eq('id', params.id)
  }

  if (field.assigned_party === 'client' && newStatus !== 'signed') {
    const { data: staff } = await db.from('profiles').select('id').in('role', ['owner', 'admin', 'manager'])
    if (staff?.length) {
      await notifyUsers(db, {
        userIds: staff.map((s) => s.id),
        title: 'Document field filled by client',
        body: `A ${field.field_type} field was filled`,
        href: `/documents/${params.id}`,
        category: 'critical_alert',
      })
    }
  }

  return NextResponse.json({ success: true, status: newStatus, mergeError })
}
