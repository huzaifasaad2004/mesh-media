import type { SupabaseClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'
import { escapeHtml } from '@/lib/utils'

export { documentFileHref, type DocumentFileVersion } from '@/lib/documentFileLinks'

export const SIGNABLE_BUCKET = 'signable-documents'

/** Recipient columns safe to hand to any viewer — never includes sign_token. */
export const SAFE_RECIPIENT_COLUMNS = 'id, name, email, role, signed_at, notified_at'

/** Merged/certificate files are only stored as getPublicUrl() links — recover their storage path. */
export function storagePathFromUrl(url?: string | null) {
  if (!url) return null
  const marker = `/object/public/${SIGNABLE_BUCKET}/`
  const at = url.indexOf(marker)
  return at === -1 ? null : decodeURIComponent(url.slice(at + marker.length).split('?')[0])
}

type Recipient = { id: string; email: string; role: string; signed_at?: string | null }

/**
 * Which recipient a logged-in user signs as. An exact email match always wins.
 * Otherwise staff act for the 'agency' recipient, and a client-portal user acts
 * for their own company's 'client' recipient — the portal login email often
 * differs from the address typed on the document.
 */
export function pickViewerRecipient<R extends Recipient>(recipients: R[], viewer: { email?: string | null; isStaff: boolean; isClient: boolean }) {
  const email = viewer.email?.toLowerCase()
  const byEmail = email ? recipients.find((r) => r.email?.toLowerCase() === email) : undefined
  if (byEmail) return byEmail
  const role = viewer.isStaff ? 'agency' : viewer.isClient ? 'client' : null
  if (!role) return null
  const candidates = recipients.filter((r) => r.role === role)
  return candidates.find((r) => !r.signed_at) ?? candidates[0] ?? null
}

/** Email each recipient their personal signing link. Marks notified_at on success. */
export async function sendSigningEmails(
  db: SupabaseClient,
  document: { id: string; title: string },
  recipients: { id: string; name: string; email: string; sign_token: string }[],
  baseUrl: string,
) {
  const results: { email: string; sent: boolean; error?: string }[] = []
  if (!process.env.RESEND_API_KEY) {
    return recipients.map((r) => ({ email: r.email, sent: false, error: 'RESEND_API_KEY not configured' }))
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const title = escapeHtml(document.title)
  for (const recipient of recipients) {
    const signUrl = `${baseUrl}/documents/${document.id}?token=${recipient.sign_token}`
    const { error: sendError } = await resend.emails.send({
      from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
      to: recipient.email,
      subject: `Please review & sign: ${document.title}`,
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
    <p>Dear ${escapeHtml(recipient.name)},</p>
    <p>We've sent over a document that needs your signature: <strong>${title}</strong>.</p>
    <p><a href="${signUrl}" class="cta">Review &amp; sign →</a></p>
    <p style="color:#555;font-size:13px;">No account or password needed — the button opens the document on any phone or computer. Tap each highlighted box to add your signature.</p>
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
  return results
}
