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

export async function GET() {
  const { data, error } = await admin()
    .from('salaries')
    .select('*, profile:profiles(id, full_name, email), payments:salary_payments(id, amount, payment_date, period)')
    .order('effective_from', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const guard = await requirePayrollWrite()
  if (guard.error) return guard.error

  const b = await req.json()
  if (!b.profile_id || !b.amount) return NextResponse.json({ error: 'Team member and amount are required' }, { status: 400 })

  const { data, error } = await admin().from('salaries').insert({
    profile_id: b.profile_id,
    amount: Number(b.amount),
    currency: b.currency || 'AED',
    pay_period: ['monthly', 'bi-weekly', 'weekly'].includes(b.pay_period) ? b.pay_period : 'monthly',
    effective_from: b.effective_from || new Date().toISOString().split('T')[0],
    notes: b.notes || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
