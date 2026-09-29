import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { serviceRole } from '@/lib/apiAuth'
import { COMPANY } from '@/lib/company'

// Body: { email } — emails a client-portal sign-in link. Public (the caller has no session yet).
// Replaces supabase.auth.signInWithOtp on the login page: that link is PKCE, so it only works
// in the exact browser that requested it — clients opening it from the Gmail app or on their
// phone hit "PKCE code verifier not found". A token_hash link to /auth/confirm (the same thing
// client invites send) works on any device, and nothing is consumed until they press Continue.
// Always answers the same way so it can't be used to discover which emails have accounts.
export async function POST(req: NextRequest) {
  const { email: rawEmail } = await req.json().catch(() => ({}))
  const email = typeof rawEmail === 'string' ? rawEmail.trim() : ''
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  }
  const ok = NextResponse.json({ ok: true })

  const db = serviceRole()
  const { data: profile } = await db.from('profiles')
    .select('id, role, archived_at')
    .ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`))
    .maybeSingle()
  if (!profile || profile.archived_at || !['client', 'contractor'].includes(profile.role)) return ok

  const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  const tokenHash = link?.properties?.hashed_token
  if (error || !tokenHash) {
    console.error('[portal-link] could not generate a sign-in link', error)
    return ok
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const next = profile.role === 'contractor' ? '/contractor-portal' : '/portal'
  const signInUrl = `${baseUrl}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=${encodeURIComponent(next)}`

  if (!process.env.RESEND_API_KEY) {
    console.error('[portal-link] RESEND_API_KEY not configured')
    return ok
  }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: sendError } = await resend.emails.send({
    from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to: email,
    subject: `Your ${COMPANY.name} sign-in link`,
    html: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="font-family:Inter,Arial,sans-serif;background:#f5f5f5;margin:0;color:#1a1a1a;">
<div style="max-width:520px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
  <div style="background:#6E1318;padding:28px 32px;"><h1 style="color:#fff;margin:0;font-size:20px;">${COMPANY.name}</h1></div>
  <div style="padding:28px 32px;font-size:14px;line-height:1.6;">
    <p>Here's your link to sign in to your ${COMPANY.name} portal. It works on any phone or computer.</p>
    <p><a href="${signInUrl}" style="display:inline-block;background:#6E1318;color:#fff;text-decoration:none;padding:13px 26px;border-radius:8px;font-weight:600;margin:12px 0;">Sign in →</a></p>
    <p style="color:#888;font-size:12px;">If you didn't ask for this, you can ignore this email. The link expires in about an hour.</p>
  </div>
  <div style="background:#f9f9f9;border-top:1px solid #eee;padding:16px 32px;font-size:11px;color:#999;text-align:center;">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
  })
  if (sendError) console.error('[portal-link] email failed', sendError)
  return ok
}
