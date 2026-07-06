import { NextRequest, NextResponse } from 'next/server'
import { requireRoles, serviceRole } from '@/lib/apiAuth'

export async function GET(req: NextRequest) {
  const auth = await requireRoles(['owner', 'admin'])
  if ('res' in auth) return auth.res

  const page = Math.max(1, Number(req.nextUrl.searchParams.get('page') ?? '1'))
  const pageSize = 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const db = serviceRole()
  const { data, error, count } = await db
    .from('activity_log')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    const friendly = error.message.includes('activity_log')
      ? 'The activity_log table hasn\'t been created yet — run supabase/phase19_activity_log.sql in the Supabase SQL editor first.'
      : error.message
    return NextResponse.json({ error: friendly }, { status: 400 })
  }

  return NextResponse.json({ entries: data ?? [], total: count ?? 0, page, pageSize })
}
