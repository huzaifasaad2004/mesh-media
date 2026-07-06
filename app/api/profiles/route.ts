import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/apiAuth'

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  // RLS-scoped: staff can read the team directory, clients cannot
  const { data, error } = await auth.db.from('profiles').select('id, full_name, email, role').order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
