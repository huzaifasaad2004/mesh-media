import { NextRequest, NextResponse } from 'next/server'
import { requireFinanceRead, requireRoles, serviceRole, stripProtected, FINANCE_WRITE } from '@/lib/apiAuth'

export async function GET() {
  const auth = await requireFinanceRead()
  if ('res' in auth) return auth.res
  const { data, error } = await serviceRole()
    .from('expenses')
    .select('*, client:clients(company_name)')
    .order('date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(FINANCE_WRITE, 'finance.write')
  if ('res' in auth) return auth.res
  const body = stripProtected(await req.json())
  const { data, error } = await serviceRole().from('expenses').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
