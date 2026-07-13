import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { serviceRole } from '@/lib/apiAuth'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Body: { token, password } — self-service, no session required. The
// contractor's personal access_token is the only credential; it's what
// lets them prove they're the one who received the emailed link.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { token, password } = await req.json()
  if (!token) return NextResponse.json({ error: 'An access token is required' }, { status: 401 })
  if (!password || password.length < 8) return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })

  const db = serviceRole()
  const { data: contractor, error } = await db.from('contractors').select('*').eq('id', params.id).eq('access_token', token).maybeSingle()
  if (error || !contractor) return NextResponse.json({ error: 'Invalid or expired access link' }, { status: 403 })
  if (!contractor.email) return NextResponse.json({ error: 'Add an email address for this contractor first — ask your account manager.' }, { status: 400 })
  if (contractor.user_id) return NextResponse.json({ error: 'A login already exists for this contractor. Use the login page instead.' }, { status: 400 })

  const auth = admin()
  const { data: created, error: createError } = await auth.auth.admin.createUser({
    email: contractor.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: contractor.name, role: 'contractor' },
  })
  if (createError || !created.user) {
    const alreadyExists = createError?.message?.toLowerCase().includes('already') ?? false
    return NextResponse.json({ error: alreadyExists ? 'An account with this email already exists — contact your account manager.' : (createError?.message ?? 'Failed to create account') }, { status: 400 })
  }

  // Belt-and-suspenders: the handle_new_user() trigger already reads
  // role from user_metadata, but set it explicitly too in case that ever
  // changes, same as the client-invite flow.
  await db.from('profiles').update({ role: 'contractor', password_set: true }).eq('id', created.user.id)
  await db.from('contractors').update({ user_id: created.user.id }).eq('id', contractor.id)

  return NextResponse.json({ success: true })
}
