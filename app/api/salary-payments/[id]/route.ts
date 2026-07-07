import { NextRequest, NextResponse } from 'next/server'
import { requirePayrollWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePayrollWrite()
  if ('res' in auth) return auth.res

  const b = await req.json()
  const patch: Record<string, unknown> = {}
  if (b.payment_date !== undefined) patch.payment_date = b.payment_date
  if (b.amount !== undefined) patch.amount = Number(b.amount)
  if (b.notes !== undefined) patch.notes = b.notes || null
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const db = serviceRole()
  const { data, error } = await db.from('salary_payments').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'update', 'salary_payment', params.id, `payment_date → ${patch.payment_date ?? data.payment_date}`)
  return NextResponse.json(data)
}
