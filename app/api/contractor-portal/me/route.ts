import { NextResponse } from 'next/server'
import { requireUser, serviceRole } from '@/lib/apiAuth'

// A contractor with a login sees only their own record — resolved via
// contractors.user_id, not the staff contractors.read/write permission
// system (they never touch that; this route is intentionally separate).
export async function GET() {
  const auth = await requireUser()
  if ('res' in auth) return auth.res
  if (auth.role !== 'contractor') return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const db = serviceRole()
  const { data: contractor, error } = await db.from('contractors').select('id, name, email, phone, status').eq('user_id', auth.user.id).single()
  if (error || !contractor) return NextResponse.json({ error: 'No contractor record linked to this account' }, { status: 404 })

  const [{ data: payments }, { data: files }] = await Promise.all([
    db.from('contractor_payments').select('*, project:projects(name)').eq('contractor_id', contractor.id).order('payment_date', { ascending: false }),
    db.from('files').select('id, name, storage_path, drive_url, file_type, file_size, created_at').eq('contractor_id', contractor.id).order('created_at', { ascending: false }),
  ])

  return NextResponse.json({ ...contractor, payments: payments ?? [], files: files ?? [] })
}
