import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRoles, serviceRole, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

// RLS-scoped: staff see all, client-portal users only their own (via my_client_ids()).
export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('signable_documents')
    .select('*, client:clients(company_name, email, contact_person), signatures:document_signatures(party, signer_name, signed_at)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { client_id, project_id?, title, file_base64, file_name, mime_type }
export async function POST(req: NextRequest) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const { client_id, project_id, title, file_base64, file_name, mime_type } = await req.json()
  if (!client_id || !title || !file_base64) {
    return NextResponse.json({ error: 'client_id, title, and a file are required' }, { status: 400 })
  }

  const db = serviceRole()
  const ext = (file_name?.split('.').pop() || 'pdf').toLowerCase()
  const path = `${client_id}/${Date.now()}.${ext}`
  const buffer = Buffer.from(file_base64, 'base64')

  const { error: uploadError } = await db.storage
    .from('signable-documents')
    .upload(path, buffer, { contentType: mime_type || 'application/pdf', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data: publicUrl } = db.storage.from('signable-documents').getPublicUrl(path)

  const { data: document, error } = await db.from('signable_documents').insert({
    client_id,
    project_id: project_id || null,
    title,
    file_url: publicUrl.publicUrl,
    storage_path: path,
    created_by: auth.user.id,
  }).select('*, client:clients(company_name, email, contact_person)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'signable_document', document.id, `${title} · ${document.client?.company_name ?? ''}`)

  // Let the client know there's something to sign, if we have an email on file.
  if (process.env.RESEND_API_KEY && document.client?.email) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    await resend.emails.send({
      from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
      to: document.client.email,
      subject: `Please review & sign: ${title}`,
      html: `<p>Dear ${document.client.contact_person ?? document.client.company_name},</p>
<p>We've sent over a document that needs your signature: <strong>${title}</strong>.</p>
<p><a href="${baseUrl}/documents/${document.id}">Review &amp; sign →</a></p>
<p>${COMPANY.name}</p>`,
    }).catch(() => {})
  }

  return NextResponse.json(document)
}
