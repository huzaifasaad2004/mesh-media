import { NextRequest, NextResponse } from 'next/server'
import { requirePayrollWrite, serviceRole } from '@/lib/apiAuth'
import { sendPayslipEmail } from '@/lib/payslip'
import { logActivity } from '@/lib/activityLog'

// Generates this month's payment for every active MONTHLY salary that
// doesn't already have one for the current period. Safe to call repeatedly —
// skips a period the moment ANY payment exists for it (partial or full);
// finishing a split payment is left to a manual "Record a payment" action.
export async function POST(_req: NextRequest) {
  const auth = await requirePayrollWrite()
  if ('res' in auth) return auth.res
  const { user } = auth
  const db = serviceRole()

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
    const { data: existing } = await db.from('salary_payments').select('id').eq('salary_id', salary.id).eq('period', period).limit(1)
    if (existing && existing.length > 0) { skipped.push(salary.profile?.full_name ?? salary.profile_id); continue }

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

  await logActivity(user, 'run', 'payroll', null, `${period} · ${generated.length} generated, ${skipped.length} skipped`)

  return NextResponse.json({ success: true, period, generated, skipped })
}
