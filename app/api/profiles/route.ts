import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/apiAuth'

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  // RLS-scoped: staff can read the team directory, clients cannot.
  // Excludes role='client' rows — this endpoint feeds staff pickers
  // (task assignee, salary recipient); client-portal accounts have a
  // profiles row too but must never appear in those dropdowns.
  const { data, error } = await auth.db.from('profiles').select('id, full_name, email, role').neq('role', 'client').order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
