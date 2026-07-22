import { NextRequest, NextResponse } from 'next/server'
import { requireStaff, requireDocumentsWrite } from '@/lib/apiAuth'
import { normalizeAgencyDocument } from '@/lib/letterhead/validation'
import { logActivity } from '@/lib/activityLog'

export async function GET() {
  const auth = await requireStaff()
  if ('res' in auth) return auth.res
  const { data, error } = await auth.db
    .from('agency_documents')
    .select('*, client:clients(id, company_name, contact_person, email, address)')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const auth = await requireDocumentsWrite()
  if ('res' in auth) return auth.res
  try {
    const body = normalizeAgencyDocument(await req.json())
    const { data, error } = await auth.db.from('agency_documents').insert({
      ...body,
      created_by: auth.user.id,
    }).select('*').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    await logActivity(auth.user, 'create', 'agency_document', data.id, data.title)
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid document' }, { status: 400 })
  }
}
