import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { sendPayslipEmail } from '@/lib/payslip'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Generates this month's payment for every active MONTHLY salary that
// doesn't already have one for the current period. Safe to call repeatedly —
// the unique (salary_id, period) index means it can never double-pay anyone.
export async function POST(_req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const db = admin()
  if (!me || !(await hasPermission(db, user.id, me.role, 'payroll.write'))) {
    return NextResponse.json({ error: 'You do not have payroll access' }, { status: 403 })
  }

  const today = new Date().toISOString().split('T')[0]
  const period = today.slice(0, 7)

  const { data: salaries } = await db
    .from('salaries')
    .select('*, profile:profiles(id, full_name, email)')
    .is('effective_to', null)
    .eq('pay_period', 'monthly')
    .lte('effective_from', today)

  const generated: string[] = []
  const skipped: string[] = []

  for (const salary of salaries ?? []) {
    const { data: existing } = await db.from('salary_payments').select('id').eq('salary_id', salary.id).eq('period', period).maybeSingle()
    if (existing) { skipped.push(salary.profile?.full_name ?? salary.profile_id); continue }

    const { data: payment, error } = await db.from('salary_payments').insert({
      profile_id: salary.profile_id,
      salary_id: salary.id,
      amount: salary.amount,
      payment_date: today,
      period,
      created_by: user.id,
    }).select().single()

    if (error || !payment) { skipped.push(`${salary.profile?.full_name ?? salary.profile_id} (error)`); continue }

    await sendPayslipEmail({
      employeeName: salary.profile?.full_name ?? 'Team Member',
      employeeEmail: salary.profile?.email ?? null,
      amount: Number(payment.amount),
      currency: salary.currency,
      period,
      paymentDate: today,
      payPeriodLabel: salary.pay_period,
      paymentId: payment.id,
    })
    await db.from('notifications').insert({
      user_id: salary.profile_id,
      title: 'Payslip ready',
      body: `Your salary for ${period} has been processed.`,
      href: `/payslip/${payment.id}`,
    })
    generated.push(salary.profile?.full_name ?? salary.profile_id)
  }

  return NextResponse.json({ success: true, period, generated, skipped })
}
