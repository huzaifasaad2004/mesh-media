import { NextRequest, NextResponse } from 'next/server'
import { requirePayrollRead, requirePayrollWrite, serviceRole } from '@/lib/apiAuth'

// Full list requires payroll.read (or owner/admin) — this used to have NO
// auth check at all and leaked every employee's salary to anyone with a
// session. Everyone else only sees their own record via /api/my-pay.
export async function GET() {
  const auth = await requirePayrollRead()
  if ('res' in auth) return auth.res

  const { data, error } = await serviceRole()
    .from('salaries')
    .select('*, profile:profiles(id, full_name, email), payments:salary_payments(id, amount, payment_date, period)')
    .order('effective_from', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const auth = await requirePayrollWrite()
  if ('res' in auth) return auth.res

  const b = await req.json()
  if (!b.profile_id || !b.amount) return NextResponse.json({ error: 'Team member and amount are required' }, { status: 400 })

  const { data, error } = await serviceRole().from('salaries').insert({
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
