import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { hasPermission } from '@/lib/permissions'
import { isAdmin } from '@/lib/roles'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { user, role } = auth

  const db = serviceRole()
  const { data: payment, error } = await db
    .from('salary_payments')
    .select('*, profile:profiles!salary_payments_profile_id_fkey(full_name, email), salary:salaries(currency, pay_period)')
    .eq('id', params.id)
    .single()
  if (error || !payment) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 })

  // Only the employee themselves or someone with payroll access may view it
  const isOwner = payment.profile_id === user.id
  const isPayroll = isAdmin(role) || await hasPermission(db, user.id, role, 'payroll.read') || await hasPermission(db, user.id, role, 'payroll.write')
  if (!isOwner && !isPayroll) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  return NextResponse.json(payment)
}
