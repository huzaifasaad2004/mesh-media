import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { serviceRole } from '@/lib/apiAuth'
import { isStaff } from '@/lib/roles'
import { notifyUsers } from '@/lib/notify'
import { mergeFieldsIntoPdf } from '@/lib/pdf/mergeDocument'
import { renderCertificatePdf } from '@/lib/pdf/CertificatePdf'
import { escapeHtml } from '@/lib/utils'
import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'
import crypto from 'crypto'

// Body: { value, token? } — base64 PNG data URL for a signature field, plain text for name/date.
// Either a logged-in session (staff filling an 'agency'-role recipient's field, or a client-portal
// user matching the recipient's email) OR a recipient's personal `token` authorizes the write —
// this is what lets an employee or any outside party sign without ever having an account.
export async function PATCH(req: NextRequest, { params }: { params: { id: string; fieldId: string } }) {
  const { value, token } = await req.json()
  if (!value?.toString().trim()) return NextResponse.json({ error: 'value is required' }, { status: 400 })

  const db = serviceRole()
  const { data: document, error: docError } = await db.from('signable_documents')
    .select('id, client_id, title, status, file_url, storage_path')
    .eq('id', params.id).single()
  if (docError || !document) return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  if (document.status === 'cancelled') return NextResponse.json({ error: 'This document was cancelled' }, { status: 400 })

  const { data: field, error: fieldError } = await db.from('document_fields')
    .select('*').eq('id', params.fieldId).eq('document_id', params.id).single()
  if (fieldError || !field) return NextResponse.json({ error: 'Field not found' }, { status: 404 })
  if (!field.recipient_id) return NextResponse.json({ error: 'This field has no recipient assigned' }, { status: 400 })

  const { data: recipient } = await db.from('document_recipients').select('*').eq('id', field.recipient_id).single()
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  let filledByUserId: string | null = null

  if (token) {
    if (token !== recipient.sign_token) return NextResponse.json({ error: 'Invalid signing link' }, { status: 403 })
  } else {
    // Fall back to a logged-in session — staff or a client-portal user whose email matches this recipient.
    const cookieStore = cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    })
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Sign in, or use your personal signing link' }, { status: 401 })
    const { data: profile } = await db.from('profiles').select('role, email').eq('id', user.id).single()
    const emailMatches = profile?.email?.toLowerCase() === recipient.email.toLowerCase()
    const staffCanActAsAgency = isStaff(profile?.role) && recipient.role === 'agency'
    if (!emailMatches && !staffCanActAsAgency) {
      return NextResponse.json({ error: 'You are not the recipient assigned to this field' }, { status: 403 })
    }
    filledByUserId = user.id
  }

  const { error: updateError } = await db.from('document_fields').update({
    value: value.toString(),
    filled_at: new Date().toISOString(),
    filled_by: filledByUserId,
  }).eq('id', params.fieldId)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })

  await db.from('document_recipients').update({ ip_address: ip }).eq('id', recipient.id)
  try {
    await db.from('activity_log').insert({
      actor_id: filledByUserId,
      actor_email: recipient.email,
      action: 'sign',
      entity_type: 'signable_document',
      entity_id: params.id,
      entity_label: `${recipient.name} filled a ${field.field_type} field`,
    })
  } catch { /* activity_log may not be migrated — never block the real mutation on this */ }

  const { data: allFields } = await db.from('document_fields').select('*').eq('document_id', params.id)
  const { data: allRecipients } = await db.from('document_recipients').select('*').eq('document_id', params.id)
  const fieldsByRecipient = new Map<string, typeof allFields>()
  for (const f of allFields ?? []) {
    if (!f.recipient_id) continue
    fieldsByRecipient.set(f.recipient_id, [...(fieldsByRecipient.get(f.recipient_id) ?? []), f])
  }

  // Mark this recipient as fully signed once every field assigned to them is filled.
  const myFields = fieldsByRecipient.get(recipient.id) ?? []
  if (myFields.length > 0 && myFields.every((f) => f.value) && !recipient.signed_at) {
    await db.from('document_recipients').update({ signed_at: new Date().toISOString() }).eq('id', recipient.id)
  }

  const remaining = (allFields ?? []).filter((f) => !f.value)
  const everyoneSigned = remaining.length === 0 && (allFields?.length ?? 0) > 0 && (allRecipients?.length ?? 0) > 0
  let newStatus = document.status
  let mergeError: string | null = null

  if (everyoneSigned) {
    try {
      const sourceRes = await fetch(document.file_url)
      const originalBytes = new Uint8Array(await sourceRes.arrayBuffer())
      const mergedBytes = await mergeFieldsIntoPdf(originalBytes, allFields!.map((f) => ({
        page_number: f.page_number, field_type: f.field_type, x: Number(f.x), y: Number(f.y),
        width: Number(f.width), height: Number(f.height), value: f.value,
      })))
      const sha256 = crypto.createHash('sha256').update(mergedBytes).digest('hex')
      const mergedPath = (document.storage_path ?? `${params.id}`).replace(/\.pdf$/i, '') + '-signed.pdf'
      const { error: uploadError } = await db.storage.from('signable-documents').upload(mergedPath, Buffer.from(mergedBytes), { contentType: 'application/pdf', upsert: true })
      if (uploadError) throw new Error(uploadError.message)
      const { data: mergedPublicUrl } = db.storage.from('signable-documents').getPublicUrl(mergedPath)

      const completedAt = new Date().toISOString()
      const certificateBuffer = await renderCertificatePdf({
        title: document.title,
        documentId: params.id,
        completedAt,
        sha256,
        recipients: (allRecipients ?? []).map((r) => ({
          name: r.name, email: r.email, role: r.role,
          signed_at: r.signed_at ?? completedAt,
          ip_address: r.ip_address,
          fields: (fieldsByRecipient.get(r.id) ?? []).map((f) => ({ field_type: f.field_type })),
        })),
      })
      const certPath = mergedPath.replace(/-signed\.pdf$/, '-certificate.pdf')
      const { error: certUploadError } = await db.storage.from('signable-documents').upload(certPath, certificateBuffer, { contentType: 'application/pdf', upsert: true })
      if (certUploadError) throw new Error(certUploadError.message)
      const { data: certPublicUrl } = db.storage.from('signable-documents').getPublicUrl(certPath)

      newStatus = 'signed'
      await db.from('signable_documents').update({
        status: newStatus, merged_file_url: mergedPublicUrl.publicUrl, completion_certificate_url: certPublicUrl.publicUrl,
      }).eq('id', params.id)

      // Every signer, plus whoever uploaded the document, gets the signed PDF + certificate.
      if (process.env.RESEND_API_KEY) {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const recipientEmails = (allRecipients ?? []).map((r) => r.email)
        const { data: creator } = await db.from('signable_documents').select('created_by').eq('id', params.id).single()
        let creatorEmail: string | null = null
        if (creator?.created_by) {
          const { data: creatorProfile } = await db.from('profiles').select('email').eq('id', creator.created_by).single()
          creatorEmail = creatorProfile?.email ?? null
        }
        const allRecipientList = (allRecipients ?? []).map((r) => `${escapeHtml(r.name)} (${escapeHtml(r.role)})`).join(', ')
        const toList = Array.from(new Set([...recipientEmails, ...(creatorEmail ? [creatorEmail] : [])]))
        for (const to of toList) {
          await resend.emails.send({
            from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
            to,
            subject: `Fully signed: ${document.title}`,
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Inter,Arial,sans-serif;background:#f5f5f5;margin:0;">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:#6E1318;padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;">${COMPANY.name}</h1></div>
  <div style="padding:28px 32px;font-size:14px;line-height:1.6;color:#1a1a1a;">
    <p><strong>${escapeHtml(document.title)}</strong> has been signed by every party.</p>
    <p style="color:#555;font-size:13px;">Signed by: ${allRecipientList}</p>
    <p>Attached: the fully signed document and a Certificate of Completion recording every signature (name, timestamp, IP address, and a document integrity hash) for your records.</p>
  </div>
  <div style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;font-size:11px;color:#999;text-align:center;">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
            attachments: [
              { filename: `${document.title}-signed.pdf`, content: Buffer.from(mergedBytes) },
              { filename: `${document.title}-certificate.pdf`, content: certificateBuffer },
            ],
          })
        }
      }
    } catch (e: any) {
      mergeError = e.message
      newStatus = 'partially_signed'
      await db.from('signable_documents').update({ status: newStatus }).eq('id', params.id)
    }
  } else {
    const anySigned = (allRecipients ?? []).some((r) => r.signed_at) || myFields.some((f) => f.value)
    newStatus = anySigned ? 'partially_signed' : document.status
    if (newStatus !== document.status) await db.from('signable_documents').update({ status: newStatus }).eq('id', params.id)
  }

  if (recipient.role !== 'agency' && newStatus !== 'signed') {
    const { data: staff } = await db.from('profiles').select('id').in('role', ['owner', 'admin', 'manager'])
    if (staff?.length) {
      await notifyUsers(db, {
        userIds: staff.map((s) => s.id),
        title: 'Document field filled',
        body: `${recipient.name} filled a ${field.field_type} field`,
        href: `/documents/${params.id}`,
        category: 'critical_alert',
      })
    }
  }

  return NextResponse.json({ success: true, status: newStatus, mergeError })
}
