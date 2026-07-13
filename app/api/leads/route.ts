import { NextRequest, NextResponse } from 'next/server'
import { requireLeadsRead, requireLeadsWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { pickLeadFields, LEAD_SELECT } from '@/lib/leads'

export async function GET() {
  const auth = await requireLeadsRead()
  if ('res' in auth) return auth.res

  const { data, error } = await serviceRole()
    .from('leads')
    .select(LEAD_SELECT)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}

// Body: { company_name, contact_name?, email?, phone?, website?, source?,
//         stage_id?, estimated_value?, currency?, next_follow_up?, notes?, assigned_to? }
export async function POST(req: NextRequest) {
  const auth = await requireLeadsWrite()
  if ('res' in auth) return auth.res

  const b = stripProtected(await req.json())
  if (typeof b.company_name !== 'string' || !b.company_name.trim()) {
    return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
  }

  const db = serviceRole()
  const clean = pickLeadFields(b)

  // Default new leads into the first pipeline stage
  if (!clean.stage_id) {
    const { data: first } = await db.from('pipeline_stages').select('id').order('position').limit(1).single()
    clean.stage_id = first?.id ?? null
  }

  const { data: lead, error } = await db.from('leads')
    .insert({ ...clean, created_by: auth.user.id })
    .select(LEAD_SELECT)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'create', 'lead', lead.id, lead.company_name)
  return NextResponse.json(lead)
}
