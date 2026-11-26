import { NextRequest, NextResponse } from 'next/server'
import { requireStaff } from '@/lib/apiAuth'

const DAY = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

/**
 * Mobile app: edit the parts of my own time entry that PUT /api/time/[id]
 * doesn't cover — the day and what it's for (task / project / client).
 * Runs on the caller's RLS-scoped client and is pinned to their own rows, so
 * it can never touch anyone else's time.
 */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const b = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  if (b.entry_date !== undefined) {
    if (typeof b.entry_date !== 'string' || !DAY.test(b.entry_date)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 })
    patch.entry_date = b.entry_date
  }
  for (const key of ['task_id', 'project_id', 'client_id'] as const) {
    if (b[key] === undefined) continue
    if (b[key] !== null && (typeof b[key] !== 'string' || !UUID.test(b[key]))) return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 })
    patch[key] = b[key]
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await auth.db.from('time_entries')
    .update(patch).eq('id', params.id).eq('user_id', auth.user.id)
    .select('*, task:tasks(title), project:projects(name), client:clients(company_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
