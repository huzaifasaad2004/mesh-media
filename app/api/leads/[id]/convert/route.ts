import { NextRequest, NextResponse } from 'next/server'
import { requireLeadsWrite, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { emitAutomationEvent } from '@/lib/automations/engine'

/** Convert a won lead into a real client row. Idempotent: if the lead was
 *  already converted, returns the existing client instead of creating another. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireLeadsWrite()
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const { data: lead, error: findErr } = await db.from('leads').select('*').eq('id', params.id).single()
  if (findErr || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
  if (lead.converted_client_id) {
    return NextResponse.json({ clientId: lead.converted_client_id, alreadyConverted: true })
  }

  const { data: client, error } = await db.from('clients').insert({
    company_name: lead.company_name,
    email: lead.email,
    phone: lead.phone,
    website: lead.website,
    notes: [lead.contact_name && `Contact: ${lead.contact_name}`, lead.notes].filter(Boolean).join('\n') || null,
    status: 'onboarding',
  }).select('id, company_name').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await db.from('leads').update({ status: 'won', converted_client_id: client.id }).eq('id', lead.id)
  await db.from('lead_activities').insert({
    lead_id: lead.id, type: 'status_change', created_by: auth.user.id,
    note: 'Won — converted to client',
  })

  await logActivity(auth.user, 'convert', 'lead', lead.id, lead.company_name)
  await emitAutomationEvent('lead_won', {
    eventKey: lead.id, actorId: auth.user.id, entityId: lead.id, entityType: 'lead', clientId: client.id,
    values: { company_name: lead.company_name, client_name: lead.company_name, estimated_value: lead.estimated_value, source: lead.source, status: 'won' },
  })
  await emitAutomationEvent('client_created', {
    eventKey: client.id, actorId: auth.user.id, entityId: client.id, entityType: 'client', clientId: client.id,
    values: { company_name: client.company_name, client_name: client.company_name, status: 'onboarding' },
  })
  return NextResponse.json({ clientId: client.id })
}
