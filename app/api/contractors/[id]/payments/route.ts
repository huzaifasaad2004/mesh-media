import { NextRequest, NextResponse } from 'next/server'
import { requireContractorsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { sendContractorReceiptEmail } from '@/lib/contractorEmail'

// Body: { amount, currency?, description?, payment_date?, project_id? }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireContractorsWrite()
  if ('res' in auth) return auth.res

  const b = await req.json()
  if (!b.amount) return NextResponse.json({ error: 'Amount is required' }, { status: 400 })

  const db = serviceRole()
  const { data: contractor, error: contractorErr } = await db.from('contractors').select('*').eq('id', params.id).single()
  if (contractorErr || !contractor) return NextResponse.json({ error: 'Contractor not found' }, { status: 404 })

  const paymentDate = b.payment_date || new Date().toISOString().split('T')[0]
  const { data: payment, error } = await db.from('contractor_payments').insert({
    contractor_id: params.id,
    project_id: b.project_id || null,
    amount: Number(b.amount),
    currency: b.currency || 'AED',
    description: b.description?.trim() || null,
    payment_date: paymentDate,
    created_by: auth.user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'pay', 'contractor', params.id, `${contractor.name} · ${payment.currency} ${payment.amount}`)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const emailResult = await sendContractorReceiptEmail({
    name: contractor.name,
    email: contractor.email,
    amount: Number(payment.amount),
    currency: payment.currency,
    description: payment.description,
    paymentDate: payment.payment_date,
    contractorUrl: `${baseUrl}/contractors/${contractor.id}?token=${contractor.access_token}`,
    receiptUrl: `${baseUrl}/receipt/${payment.id}?token=${contractor.access_token}`,
  })

  return NextResponse.json({ success: true, payment, emailed: emailResult.sent, emailError: emailResult.error })
}
