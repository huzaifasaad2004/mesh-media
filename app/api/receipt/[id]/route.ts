import { NextRequest, NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'
import { hasPermission } from '@/lib/permissions'
import { isAdmin } from '@/lib/roles'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = serviceRole()
  const { data: payment, error } = await db
    .from('contractor_payments')
    .select('*, contractor:contractors(name, email, access_token, user_id), project:projects(name)')
    .eq('id', params.id)
    .single()
  if (error || !payment) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

  const token = req.nextUrl.searchParams.get('token')
  if (token && token === payment.contractor?.access_token) {
    const { access_token, user_id, ...contractor } = payment.contractor
    return NextResponse.json({ ...payment, contractor })
  }

  // No valid token — fall back to a logged-in session: staff with contractors
  // access, or the contractor themselves viewing their own receipt.
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  const { user, role } = auth
  const isOwnContractorAccount = role === 'contractor' && payment.contractor?.user_id === user.id
  const canView = isOwnContractorAccount || isAdmin(role) || await hasPermission(db, user.id, role, 'contractors.read') || await hasPermission(db, user.id, role, 'contractors.write')
  if (!canView) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const { access_token, user_id, ...contractor } = payment.contractor
  return NextResponse.json({ ...payment, contractor })
}
