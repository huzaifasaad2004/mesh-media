import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'
import { runAutomationEvent } from '@/lib/automations/engine'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const db = serviceRole()
  const { data: rule, error } = await db.from('automation_rules').select('*').eq('id', params.id).single()
  if (error || !rule) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
  const body = await req.json().catch(() => ({}))
  const results = await runAutomationEvent(rule.trigger_type, {
    eventKey: `manual-${Date.now()}`, actorId: auth.user.id,
    entityType: 'manual', values: { workflow_name: rule.name, ...(body.values ?? {}) },
    clientId: body.client_id ?? null, projectId: body.project_id ?? null,
  }, db, rule.id)
  return NextResponse.json({ result: results.find(result => result.rule_id === rule.id) ?? null })
}
