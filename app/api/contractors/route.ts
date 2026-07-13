import { NextRequest, NextResponse } from 'next/server'
import { requireContractorsRead, requireContractorsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { sendContractorWelcomeEmail } from '@/lib/contractorEmail'

export async function GET() {
  const auth = await requireContractorsRead()
  if ('res' in auth) return auth.res

  const { data, error } = await serviceRole()
    .from('contractors')
    .select('*, payments:contractor_payments(id, amount, currency, payment_date)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { name, email?, phone?, bank_details?, notes? }
export async function POST(req: NextRequest) {
  const auth = await requireContractorsWrite()
  if ('res' in auth) return auth.res

  const b = await req.json()
  if (!b.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const db = serviceRole()
  const { data: contractor, error } = await db.from('contractors').insert({
    name: b.name.trim(),
    email: b.email?.trim() || null,
    phone: b.phone?.trim() || null,
    bank_details: b.bank_details?.trim() || null,
    notes: b.notes?.trim() || null,
    created_by: auth.user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'contractor', contractor.id, contractor.name)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const contractorUrl = `${baseUrl}/contractors/${contractor.id}?token=${contractor.access_token}`
  const emailResult = await sendContractorWelcomeEmail({ name: contractor.name, email: contractor.email, contractorUrl })

  return NextResponse.json({ ...contractor, emailSent: emailResult.sent, emailError: emailResult.error })
}
