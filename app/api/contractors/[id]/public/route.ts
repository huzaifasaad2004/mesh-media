import { NextRequest, NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'

// Unauthenticated read for a contractor's personal payment page — no login
// required. The token itself is the credential, same as document recipients.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'An access token is required' }, { status: 401 })

  const db = serviceRole()
  const { data: contractor, error } = await db.from('contractors')
    .select('id, name, email, phone, status, user_id')
    .eq('id', params.id).eq('access_token', token).maybeSingle()
  if (error || !contractor) return NextResponse.json({ error: 'Invalid or expired access link' }, { status: 403 })

  const [{ data: payments }, { data: files }] = await Promise.all([
    db.from('contractor_payments').select('*, project:projects(name)').eq('contractor_id', params.id).order('payment_date', { ascending: false }),
    db.from('files').select('id, name, storage_path, drive_url, file_type, file_size, created_at').eq('contractor_id', params.id).order('created_at', { ascending: false }),
  ])

  const { user_id, ...rest } = contractor
  return NextResponse.json({ ...rest, has_login: !!user_id, payments: payments ?? [], files: files ?? [] })
}
