import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasPermission } from '@/lib/permissions'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = admin()
  const { data: payment, error } = await db
    .from('salary_payments')
    .select('*, profile:profiles(full_name, email), salary:salaries(currency, pay_period)')
    .eq('id', params.id)
    .single()
  if (error || !payment) return NextResponse.json({ error: 'Payslip not found' }, { status: 404 })

  // Only the employee themselves or someone with payroll access may view it
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isOwner = payment.profile_id === user.id
  const isPayroll = me && (['owner', 'admin'].includes(me.role) || await hasPermission(db, user.id, me.role, 'payroll.write'))
  if (!isOwner && !isPayroll) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  return NextResponse.json(payment)
}
