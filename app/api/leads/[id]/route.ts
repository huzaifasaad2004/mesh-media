import { NextRequest, NextResponse } from 'next/server'
import { requireLeadsWrite, serviceRole, stripProtected } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { pickLeadFields, LEAD_SELECT } from '@/lib/leads'
import { emitAutomationEvent } from '@/lib/automations/engine'

// Body: any subset of lead fields, plus optional { status, lost_reason }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireLeadsWrite()
  if ('res' in auth) return auth.res

  const b = stripProtected(await req.json())
  const db = serviceRole()

  const { data: before, error: findErr } = await db.from('leads')
    .select('id, company_name, stage_id, status, stage:pipeline_stages(name)')
    .eq('id', params.id).single()
  if (findErr || !before) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const clean = pickLeadFields(b)
  if (typeof b.status === 'string' && ['open', 'won', 'lost'].includes(b.status)) {
    clean.status = b.status
    clean.lost_reason = b.status === 'lost' ? (typeof b.lost_reason === 'string' ? b.lost_reason.trim() || null : null) : null
  }
  if (clean.company_name === null) delete clean.company_name // never blank out the name

  const { data: lead, error } = await db.from('leads')
    .update(clean)
    .eq('id', params.id)
    .select(LEAD_SELECT)
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Auto-log stage moves and won/lost transitions on the lead's timeline
  if (clean.stage_id && clean.stage_id !== before.stage_id) {
    await db.from('lead_activities').insert({
      lead_id: lead.id, type: 'stage_change', created_by: auth.user.id,
      note: `Moved to ${lead.stage?.name ?? 'a new stage'}`,
    })
  }
  if (clean.status && clean.status !== before.status) {
    await db.from('lead_activities').insert({
      lead_id: lead.id, type: 'status_change', created_by: auth.user.id,
      note: clean.status === 'won' ? 'Marked as won'
        : clean.status === 'lost' ? `Marked as lost${clean.lost_reason ? ` — ${clean.lost_reason}` : ''}`
        : 'Reopened',
    })
  }

  await logActivity(auth.user, 'update', 'lead', lead.id, lead.company_name)
  if (clean.status === 'won' && before.status !== 'won') {
    await emitAutomationEvent('lead_won', {
      eventKey: lead.id, actorId: auth.user.id, entityId: lead.id, entityType: 'lead',
      clientId: lead.converted_client_id ?? null,
      values: { company_name: lead.company_name, client_name: lead.company_name, estimated_value: lead.estimated_value, source: lead.source, status: lead.status },
    })
  }
  return NextResponse.json(lead)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireLeadsWrite()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: lead } = await db.from('leads').select('id, company_name').eq('id', params.id).single()
  if (!lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

  const { error } = await db.from('leads').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await logActivity(auth.user, 'delete', 'lead', lead.id, lead.company_name)
  return NextResponse.json({ ok: true })
}
