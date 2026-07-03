import { NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const admin = () => createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const db = admin()
  const [{ data: salary }, { data: payments }] = await Promise.all([
    db.from('salaries').select('*').eq('profile_id', user.id).is('effective_to', null).order('effective_from', { ascending: false }).limit(1).maybeSingle(),
    db.from('salary_payments').select('*').eq('profile_id', user.id).order('payment_date', { ascending: false }),
  ])
  return NextResponse.json({ salary: salary ?? null, payments: payments ?? [] })
}
