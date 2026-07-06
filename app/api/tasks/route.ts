import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, requireRoles, serviceRole, stripProtected, OPS_WRITE } from '@/lib/apiAuth'

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('tasks')
    .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, avatar_url, email), client:clients(company_name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(OPS_WRITE)
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('tasks').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
