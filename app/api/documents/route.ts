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
  let emailSent = false
  let emailError: string | null = null
  if (!process.env.RESEND_API_KEY) {
    emailError = 'RESEND_API_KEY not configured'
  } else if (!document.client?.email) {
    emailError = 'No email on file for this client'
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const recipient = document.client.contact_person ?? document.client.company_name
    const { error: sendError } = await resend.emails.send({
      from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
      to: document.client.email,
      subject: `Please review & sign: ${title}`,
      html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
  body { font-family: Inter, Arial, sans-serif; margin:0; background:#f5f5f5; color:#1a1a1a; }
  .wrap { max-width:520px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  .header { background:#6E1318; padding:28px 32px; }
  .header h1 { color:#fff; margin:0; font-size:20px; font-weight:700; }
  .body { padding:28px 32px; font-size:14px; line-height:1.6; }
  .cta { display:inline-block; background:#6E1318; color:#fff !important; text-decoration:none; padding:13px 26px; border-radius:8px; font-weight:600; margin:18px 0; }
  .footer { background:#f9f9f9; border-top:1px solid #eee; padding:16px 32px; font-size:11px; color:#999; text-align:center; }
</style></head><body>
<div class="wrap">
  <div class="header"><h1>${COMPANY.name}</h1></div>
  <div class="body">
    <p>Dear ${recipient},</p>
    <p>We've sent over a document that needs your signature: <strong>${title}</strong>.</p>
    <p><a href="${baseUrl}/documents/${document.id}" class="cta">Review &amp; sign →</a></p>
    <p style="color:#888;font-size:12px;">If the button doesn't work, copy and paste this URL into your browser:<br>${baseUrl}/documents/${document.id}</p>
  </div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
    })
    if (sendError) {
      emailError = sendError.message
      console.error(`[documents] Failed to email signature request for document ${document.id}:`, sendError)
    } else {
      emailSent = true
    }
  }

  return NextResponse.json({ ...document, emailSent, emailError })
}
