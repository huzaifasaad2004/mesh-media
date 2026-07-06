import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Only owner/admin may invite portal users
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !['owner', 'admin'].includes(me.role)) {
    return NextResponse.json({ error: 'Only admins can invite clients' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: client, error: clientError } = await admin
    .from('clients').select('id, company_name, email, contact_person').eq('id', params.id).single()
  if (clientError || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const email = (body.email ?? client.email)?.trim()
  if (!email) return NextResponse.json({ error: 'Client has no email address — add one first' }, { status: 400 })

  // Guard: never turn a staff member into a client. One email = one account =
  // one role, so inviting a staff email as a client would demote them.
  const { data: existingProfile } = await admin
    .from('profiles').select('id, role').ilike('email', email).maybeSingle()
  if (existingProfile && ['owner', 'admin', 'manager', 'member', 'viewer'].includes(existingProfile.role)) {
    return NextResponse.json({
      error: 'This email belongs to a team member. Use a different email for client portal access.',
    }, { status: 400 })
  }

  // Same click-to-confirm pattern as team invites — see that route for why.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const fullName = client.contact_person ?? client.company_name

  // Generate a sign-in link (works whether or not the user already exists),
  // then email it ourselves via Resend from the verified m3m.ae domain.
  let actionLink: string | undefined
  let userId: string | undefined

  const invite = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName, role: 'client' } },
  })

  if (invite.error) {
    const msg = invite.error.message.toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      // Existing user — send a magic link instead
      const magic = await admin.auth.admin.generateLink({ type: 'magiclink', email })
      if (magic.error) return NextResponse.json({ error: magic.error.message }, { status: 400 })
      if (magic.data.properties?.hashed_token) {
        actionLink = `${baseUrl}/auth/confirm?token_hash=${magic.data.properties.hashed_token}&type=magiclink&next=/portal`
      }
      userId = magic.data.user?.id
    } else {
      return NextResponse.json({ error: invite.error.message }, { status: 400 })
    }
  } else {
    if (invite.data.properties?.hashed_token) {
      actionLink = `${baseUrl}/auth/confirm?token_hash=${invite.data.properties.hashed_token}&type=invite&next=/portal`
    }
    userId = invite.data.user?.id
  }

  if (!actionLink || !userId) {
    return NextResponse.json({ error: 'Could not generate an invite link' }, { status: 500 })
  }

  // Link the user to this client and ensure client role
  await admin.from('client_contacts').upsert(
    { user_id: userId, client_id: params.id },
    { onConflict: 'user_id,client_id' }
  )
  await admin.from('profiles').update({ role: 'client' }).eq('id', userId)

  // Send the branded invite email via Resend
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error: sendError } = await resend.emails.send({
    from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to: email,
    subject: `Your MeshMedia client portal is ready`,
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
    <p>You've been given access to your private client portal, where you can view your projects, approve quotations, see invoices, download files, and send us requests.</p>
    <p><a href="${actionLink}" class="cta">Open my client portal →</a></p>
    <p style="color:#888;font-size:12px;">This secure link signs you in automatically. If the button doesn't work, copy and paste this URL into your browser:<br>${actionLink}</p>
  </div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
  })

  if (sendError) return NextResponse.json({ error: `Invite created but email failed: ${sendError.message}` }, { status: 500 })

  return NextResponse.json({ success: true, to: email })
}
