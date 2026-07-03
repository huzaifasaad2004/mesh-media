import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function requirePayrollWrite() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!me || !(await hasPermission(admin(), user.id, me.role, 'payroll.write'))) {
    return { error: NextResponse.json({ error: 'You do not have payroll access' }, { status: 403 }) }
  }
  return { userId: user.id }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePayrollWrite()
  if (guard.error) return guard.error

  const b = await req.json()
  const patch: Record<string, unknown> = {}
  if (b.amount !== undefined) patch.amount = Number(b.amount)
  if (b.currency !== undefined) patch.currency = b.currency
  if (b.pay_period !== undefined) patch.pay_period = b.pay_period
  if (b.effective_to !== undefined) patch.effective_to = b.effective_to || null
  if (b.notes !== undefined) patch.notes = b.notes || null

  const { data, error } = await admin().from('salaries').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const guard = await requirePayrollWrite()
  if (guard.error) return guard.error
  const { error } = await admin().from('salaries').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
