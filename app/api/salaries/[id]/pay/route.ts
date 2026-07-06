import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'
import { sendPayslipEmail } from '@/lib/payslip'
import { logActivity } from '@/lib/activityLog'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const db = admin()
  if (!me || !(await hasPermission(db, user.id, me.role, 'payroll.write'))) {
    return NextResponse.json({ error: 'You do not have payroll access' }, { status: 403 })
  }

  const b = await req.json().catch(() => ({}))
  const { data: salary, error: salaryErr } = await db
    .from('salaries')
    .select('*, profile:profiles(id, full_name, email)')
    .eq('id', params.id)
    .single()
  if (salaryErr || !salary) return NextResponse.json({ error: 'Salary record not found' }, { status: 404 })

  const paymentDate = b.payment_date || new Date().toISOString().split('T')[0]
  const period = b.period || paymentDate.slice(0, 7)

  const { data: payment, error } = await db.from('salary_payments').insert({
    profile_id: salary.profile_id,
    salary_id: salary.id,
    amount: b.amount ? Number(b.amount) : salary.amount,
    payment_date: paymentDate,
    period,
    notes: b.notes || null,
    created_by: user.id,
  }).select().single()

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return NextResponse.json({ error: `Already paid for ${period}` }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  const emailResult = await sendPayslipEmail({
    employeeName: salary.profile?.full_name ?? 'Team Member',
    employeeEmail: salary.profile?.email ?? null,
    amount: Number(payment.amount),
    currency: salary.currency,
    period,
    paymentDate,
    payPeriodLabel: salary.pay_period,
    paymentId: payment.id,
  })

  // Notify the employee in-app too, regardless of email outcome
  await db.from('notifications').insert({
    user_id: salary.profile_id,
    title: 'Payslip ready',
    body: `Your salary for ${period} has been processed.`,
    href: `/payslip/${payment.id}`,
  })

  await logActivity(user, 'pay', 'salary', payment.id, `${salary.profile?.full_name ?? 'Team member'} · ${period}`)

  return NextResponse.json({ success: true, payment_id: payment.id, emailed: emailResult.sent, emailError: emailResult.error })
}
