import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

export async function POST(req: NextRequest) {
  // Only owner/admin may invite
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['owner', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Only admins can invite team members' }, { status: 403 })
  }

  const { email: rawEmail, full_name, role } = await req.json()
  const email = rawEmail?.trim()
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 })

  const allowedRoles = ['admin', 'manager', 'member', 'viewer']
  const inviteRole = allowedRoles.includes(role) ? role : 'member'

  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const redirectTo = `${baseUrl}/auth/callback?next=/dashboard`
  const fullName = full_name || email.split('@')[0]

  // Generate the sign-in link ourselves and email it via Resend from our own
  // domain, instead of relying on Supabase's default (unbranded, easily
  // spam-filtered) invite email.
  let actionLink: string | undefined
  let userId: string | undefined
  let isNewAccount = false

  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName, role: inviteRole }, redirectTo },
  })

  if (invite.error) {
    const msg = invite.error.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      const magic = await admin.auth.admin.generateLink({ type: 'magiclink', email, options: { redirectTo } })
      if (magic.error) return NextResponse.json({ error: magic.error.message }, { status: 400 })
      actionLink = magic.data.properties?.action_link
      userId = magic.data.user?.id
    } else {
      return NextResponse.json({ error: invite.error.message }, { status: 400 })
    }
  } else {
    actionLink = invite.data.properties?.action_link
    userId = invite.data.user?.id
    isNewAccount = true
  }

  if (!actionLink || !userId) {
    return NextResponse.json({ error: 'Could not generate an invite link' }, { status: 500 })
  }

  // Guard: never let this accidentally demote an existing client-portal user into staff
  // without the admin knowing — but a staff invite should always win the role assignment.
  const patch: Record<string, unknown> = { role: inviteRole, full_name: fullName }
  if (isNewAccount) patch.password_set = false // force them through /set-password
  await admin.from('profiles').update(patch).eq('id', userId)

  // Send the branded invite email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: sendError } = await resend.emails.send({
    from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to: email,
    subject: isNewAccount ? `You're invited to Mesh Media Agency OS` : `Your Mesh Media sign-in link`,
    html: `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
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
    <p>Hi ${fullName},</p>
    <p>${isNewAccount
      ? `You've been added to the MeshMedia Agency OS team as <strong>${inviteRole}</strong>. Click below to activate your account and choose a password.`
      : `Here's your sign-in link to Mesh Media Agency OS.`}</p>
    <p><a href="${actionLink}" class="cta">${isNewAccount ? 'Activate my account →' : 'Sign in →'}</a></p>
    <p style="color:#888;font-size:12px;">If the button doesn't work, copy and paste this URL into your browser:<br>${actionLink}</p>
  </div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
  })

  if (sendError) return NextResponse.json({ error: `Invite created but email failed: ${sendError.message}` }, { status: 500 })

  return NextResponse.json({ success: true, to: email })
}
