import { NextRequest, NextResponse } from 'next/server'
import { requireUser, requireRoles, serviceRole, stripProtected, OPS_WRITE } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  // RLS-scoped: staff see all clients, client-portal users only their own
  const { data, error } = await auth.db.from('clients').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('clients').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'create', 'client', data.id, data.company_name)
  return NextResponse.json(data)
}
