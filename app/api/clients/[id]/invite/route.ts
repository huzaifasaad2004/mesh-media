import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

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

  const email = body.email ?? client.email
  if (!email) return NextResponse.json({ error: 'Client has no email address — add one first' }, { status: 400 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: client.contact_person ?? client.company_name, role: 'client' },
    redirectTo: `${baseUrl}/auth/callback?next=/portal`,
  })

  // Already-registered users are fine — we still (re)link them to the client
  let userId = data?.user?.id
  if (error) {
    if (error.message.toLowerCase().includes('already been registered')) {
      const { data: list } = await admin.auth.admin.listUsers()
      userId = list?.users.find(u => u.email?.toLowerCase() === String(email).toLowerCase())?.id
      if (!userId) return NextResponse.json({ error: error.message }, { status: 400 })
    } else {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
  }

  if (userId) {
    await admin.from('client_contacts').upsert(
      { user_id: userId, client_id: params.id },
      { onConflict: 'user_id,client_id' }
    )
    // Ensure their profile is the client role
    await admin.from('profiles').update({ role: 'client' }).eq('id', userId)
  }

  return NextResponse.json({ success: true, to: email })
}
