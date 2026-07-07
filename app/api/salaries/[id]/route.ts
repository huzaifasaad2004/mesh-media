import { NextRequest, NextResponse } from 'next/server'
import { requirePayrollWrite, serviceRole } from '@/lib/apiAuth'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePayrollWrite()
  if ('res' in auth) return auth.res

  const b = await req.json()
  const patch: Record<string, unknown> = {}
  if (b.amount !== undefined) patch.amount = Number(b.amount)
  if (b.currency !== undefined) patch.currency = b.currency
  if (b.pay_period !== undefined) patch.pay_period = b.pay_period
  if (b.effective_to !== undefined) patch.effective_to = b.effective_to || null
  if (b.notes !== undefined) patch.notes = b.notes || null

  const { data, error } = await serviceRole().from('salaries').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePayrollWrite()
  if ('res' in auth) return auth.res
  const { error } = await serviceRole().from('salaries').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
