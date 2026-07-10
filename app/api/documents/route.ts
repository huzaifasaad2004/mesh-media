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
    .select('*, client:clients(company_name, email, contact_person), signatures:document_signatures(party, signer_name, signed_at), fields:document_fields(id, recipient_id, value), recipients:document_recipients(id, name, email, role, signed_at)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { client_id?, project_id?, title, file_base64, file_name, mime_type, recipients: [{ name, email, role }] }
// `recipients` replaces "pick a client" as the signer list — any mix of clients, employees, or
// anyone else with a name + email. `client_id` is now just an optional CRM association.
export async function POST(req: NextRequest) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res

  const { client_id, project_id, title, file_base64, file_name, mime_type, recipients } = await req.json()
  if (!title || !file_base64) {
    return NextResponse.json({ error: 'title and a file are required' }, { status: 400 })
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return NextResponse.json({ error: 'At least one recipient (name + email) is required' }, { status: 400 })
  }
  for (const r of recipients) {
    if (!r.name?.trim() || !r.email?.trim()) {
      return NextResponse.json({ error: 'Every recipient needs a name and email' }, { status: 400 })
    }
  }

  const db = serviceRole()
  const ext = (file_name?.split('.').pop() || 'pdf').toLowerCase()
  const path = `${client_id || 'unlinked'}/${Date.now()}.${ext}`
  const buffer = Buffer.from(file_base64, 'base64')

  const { error: uploadError } = await db.storage
    .from('signable-documents')
    .upload(path, buffer, { contentType: mime_type || 'application/pdf', upsert: false })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 })

  const { data: publicUrl } = db.storage.from('signable-documents').getPublicUrl(path)

  const { data: document, error } = await db.from('signable_documents').insert({
    client_id: client_id || null,
    project_id: project_id || null,
    title,
    file_url: publicUrl.publicUrl,
    storage_path: path,
    created_by: auth.user.id,
  }).select('*, client:clients(company_name, email, contact_person)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data: createdRecipients, error: recipError } = await db.from('document_recipients').insert(
    recipients.map((r: any) => ({ document_id: document.id, name: r.name.trim(), email: r.email.trim(), role: ['agency', 'client', 'employee', 'other'].includes(r.role) ? r.role : 'other' }))
  ).select('*')
  if (recipError) return NextResponse.json({ error: recipError.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'signable_document', document.id, `${title} · ${createdRecipients.length} recipient(s)`)

  // Email every recipient their own personal signing link (token-based — no account required).
  const results: { email: string; sent: boolean; error?: string }[] = []
  if (!process.env.RESEND_API_KEY) {
    results.push({ email: 'all', sent: false, error: 'RESEND_API_KEY not configured' })
  } else {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    for (const recipient of createdRecipients) {
      const signUrl = `${baseUrl}/documents/${document.id}?token=${recipient.sign_token}`
      const { error: sendError } = await resend.emails.send({
        from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
        to: recipient.email,
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
    <p>Dear ${recipient.name},</p>
    <p>We've sent over a document that needs your signature: <strong>${title}</strong>.</p>
    <p><a href="${signUrl}" class="cta">Review &amp; sign →</a></p>
    <p style="color:#888;font-size:12px;">This link is personal to you — please don't forward it. If the button doesn't work, copy and paste this URL into your browser:<br>${signUrl}</p>
  </div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
      })
      if (sendError) {
        console.error(`[documents] Failed to email signing link to ${recipient.email} for document ${document.id}:`, sendError)
        results.push({ email: recipient.email, sent: false, error: sendError.message })
      } else {
        await db.from('document_recipients').update({ notified_at: new Date().toISOString() }).eq('id', recipient.id)
        results.push({ email: recipient.email, sent: true })
      }
    }
  }

  return NextResponse.json({ ...document, recipients: createdRecipients, emailResults: results })
}
