import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  const db = serviceRole()

  const { data: client, error: clientError } = await db
    .from('clients').select('id, company_name, email, portal_enabled').eq('id', params.id).single()
  if (clientError || !client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const { data: contacts } = await db
    .from('client_contacts').select('user_id').eq('client_id', params.id)

  const userIds = (contacts ?? []).map((c) => c.user_id)
  let users: { id: string; full_name: string | null; email: string | null; last_sign_in_at: string | null }[] = []

  if (userIds.length) {
    const { data: profiles } = await db.from('profiles').select('id, full_name, email').in('id', userIds)
    // auth.users isn't queryable via the table API — fetch sign-in times via the admin auth API instead.
    const authLookups = await Promise.all(
      userIds.map((id) => db.auth.admin.getUserById(id).then((r) => r.data.user).catch(() => null))
    )
    const lastSignIn = new Map(authLookups.filter(Boolean).map((u: any) => [u.id, u.last_sign_in_at]))
    users = (profiles ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      last_sign_in_at: lastSignIn.get(p.id) ?? null,
    }))
  }

  // portal_enabled defaults to true until phase18 migration adds the column
  const portalEnabled = client.portal_enabled ?? true

  return NextResponse.json({
    client: { id: client.id, company_name: client.company_name, email: client.email },
    portal_enabled: portalEnabled,
    users,
  })
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  const { portal_enabled } = await req.json()
  if (typeof portal_enabled !== 'boolean') {
    return NextResponse.json({ error: 'portal_enabled (boolean) is required' }, { status: 400 })
  }

  const db = serviceRole()
  const { error } = await db.from('clients').update({ portal_enabled }).eq('id', params.id)
  if (error) {
    const friendly = error.message.includes('portal_enabled')
      ? 'The portal_enabled column hasn\'t been added yet — run supabase/phase18_portal_access.sql in the Supabase SQL editor first.'
      : error.message
    return NextResponse.json({ error: friendly }, { status: 400 })
  }

  await logActivity(auth.user, portal_enabled ? 'enable' : 'disable', 'client_portal', params.id)

  return NextResponse.json({ success: true })
}
