import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireRoles, serviceRole } from '@/lib/apiAuth'
import { COMPANY } from '@/lib/company'

// Admin password management for team members:
//   { action: 'set', password }  — set the password directly (tell them in person/WhatsApp)
//   { action: 'reset' }          — email them a branded reset link (click-to-confirm)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  const admin = serviceRole()
  const { data: target } = await admin.from('profiles').select('id, email, full_name, role').eq('id', params.id).single()
  if (!target) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

  // Hierarchy guard: nobody manages the owner's password, and only the
  // owner may manage other admins.
  if (target.role === 'owner') {
    return NextResponse.json({ error: "The owner's password can only be changed by the owner themselves" }, { status: 403 })
  }
  if (target.role === 'admin' && auth.role !== 'owner' && auth.user.id !== target.id) {
    return NextResponse.json({ error: 'Only the owner can manage another admin’s password' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))

  if (body.action === 'set') {
    const password = String(body.password ?? '')
    if (password.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
    }
    const { error } = await admin.auth.admin.updateUserById(target.id, { password })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    // They have a real password now — don't force the set-password screen.
    await admin.from('profiles').update({ password_set: true }).eq('id', target.id)
    return NextResponse.json({ success: true, message: `Password updated for ${target.email}` })
  }

  if (body.action === 'reset') {
    if (!target.email) return NextResponse.json({ error: 'Member has no email address' }, { status: 400 })
    const { data: link, error } = await admin.auth.admin.generateLink({ type: 'recovery', email: target.email })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const tokenHash = link.properties?.hashed_token
    if (!tokenHash) return NextResponse.json({ error: 'Could not generate a reset link' }, { status: 500 })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
    const resetUrl = `${baseUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/dashboard`

    const resend = new Resend(process.env.RESEND_API_KEY)
    const { error: sendError } = await resend.emails.send({
      from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
      to: target.email,
      subject: 'Reset your Mesh Media password',
      html: `
<!DOCTYPE html><html><head><meta charset="utf-8"><style>
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
    <p>Hi ${target.full_name ?? ''},</p>
    <p>An administrator requested a password reset for your Mesh Media Agency OS account. Click below to choose a new password.</p>
    <p><a href="${resetUrl}" class="cta">Reset my password →</a></p>
    <p style="color:#888;font-size:12px;">If you didn't expect this, you can safely ignore it. If the button doesn't work, copy and paste this URL:<br>${resetUrl}</p>
  </div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
    })
    if (sendError) return NextResponse.json({ error: `Reset link created but email failed: ${sendError.message}` }, { status: 500 })
    return NextResponse.json({ success: true, message: `Reset link sent to ${target.email}` })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
