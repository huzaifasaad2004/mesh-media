import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireDocumentsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { SIGNABLE_BUCKET, SAFE_RECIPIENT_COLUMNS } from '@/lib/signableDocuments'
import { MAX_DIRECT_UPLOAD_BYTES, MAX_DIRECT_UPLOAD_LABEL } from '@/lib/uploadLimits'

// RLS-scoped: staff see all, client-portal users only their own (via my_client_ids()).
export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('signable_documents')
    .select('*, client:clients(company_name, email, contact_person), signatures:document_signatures(party, signer_name, signed_at), fields:document_fields(id, recipient_id, value), recipients:document_recipients(id, name, email, role, signed_at)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { client_id?, project_id?, title, file_base64, file_name, mime_type, recipients: [{ name, email, role }], already_signed? }
// `recipients` replaces "pick a client" as the signer list — any mix of clients, employees, or
// anyone else with a name + email. `client_id` is now just an optional CRM association.
// Signing links are NOT emailed here: recipients who open a link before any signature boxes
// exist can't sign, so emails go out from /api/documents/[id]/send once fields are placed.
// `already_signed` stores a contract that was signed outside the app (e.g. on paper) straight
// into the client's portal as a signed document — no recipients, fields, or emails.
export async function POST(req: NextRequest) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res

  const { client_id, project_id, title, file_base64, file_name, mime_type, recipients, already_signed } = await req.json()
  if (!title || !file_base64) {
    return NextResponse.json({ error: 'title and a file are required' }, { status: 400 })
  }
  if (already_signed) {
    if (!client_id) return NextResponse.json({ error: 'Choose the client whose portal this signed copy belongs in' }, { status: 400 })
  } else {
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'At least one recipient (name + email) is required' }, { status: 400 })
    }
    for (const r of recipients) {
      if (!r.name?.trim() || !r.email?.trim()) {
        return NextResponse.json({ error: 'Every recipient needs a name and email' }, { status: 400 })
      }
    }
  }

  const buffer = Buffer.from(file_base64, 'base64')
  if (buffer.byteLength > MAX_DIRECT_UPLOAD_BYTES) {
    return NextResponse.json({ error: `File is too large for direct upload (max ${MAX_DIRECT_UPLOAD_LABEL})` }, { status: 400 })
  }

  const db = serviceRole()
  const ext = (file_name?.split('.').pop() || 'pdf').toLowerCase()
  const path = `${client_id || 'unlinked'}/${Date.now()}.${ext}`

  const { error: uploadError } = await db.storage
    .from(SIGNABLE_BUCKET)
    .upload(path, buffer, { contentType: mime_type || 'application/pdf', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data: publicUrl } = db.storage.from(SIGNABLE_BUCKET).getPublicUrl(path)

  const { data: document, error } = await db.from('signable_documents').insert({
    client_id: client_id || null,
    project_id: project_id || null,
    title,
    file_url: publicUrl.publicUrl,
    storage_path: path,
    created_by: auth.user.id,
    ...(already_signed ? { status: 'signed', merged_file_url: publicUrl.publicUrl } : {}),
  }).select('*, client:clients(company_name, email, contact_person)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  if (already_signed) {
    await logActivity(auth.user, 'create', 'signable_document', document.id, `${title} · signed copy stored`)
    return NextResponse.json({ ...document, recipients: [] })
  }

  const { data: createdRecipients, error: recipError } = await db.from('document_recipients').insert(
    recipients.map((r: any) => ({ document_id: document.id, name: r.name.trim(), email: r.email.trim(), role: ['agency', 'client', 'employee', 'other'].includes(r.role) ? r.role : 'other' }))
  ).select(SAFE_RECIPIENT_COLUMNS)
  if (recipError) return NextResponse.json({ error: recipError.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'signable_document', document.id, `${title} · ${createdRecipients.length} recipient(s)`)

  return NextResponse.json({ ...document, recipients: createdRecipients })
}
