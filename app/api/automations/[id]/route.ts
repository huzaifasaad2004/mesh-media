import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import type { AutomationRuleDraft } from '@/lib/automations/types'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const body = await req.json() as Partial<AutomationRuleDraft>
  const db = serviceRole()
  const patch: Record<string, any> = {}
  if (typeof body.name === 'string') patch.name = body.name.trim()
  if ('description' in body) patch.description = body.description?.trim() || null
  if (body.trigger_type) patch.trigger_type = body.trigger_type
  if (body.trigger_config) patch.trigger_config = body.trigger_config
  if (body.conditions) patch.conditions = body.conditions
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active
  const { data: rule, error } = await db.from('automation_rules').update(patch).eq('id', params.id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (body.actions) {
    if (!body.actions.length) return NextResponse.json({ error: 'Add at least one action' }, { status: 400 })
    await db.from('automation_actions').delete().eq('rule_id', params.id)
    const { error: actionError } = await db.from('automation_actions').insert(body.actions.map((action, index) => ({
      rule_id: params.id, action_type: action.action_type, config: action.config ?? {}, sort_order: index,
    })))
    if (actionError) return NextResponse.json({ error: actionError.message }, { status: 400 })
  }
  await logActivity(auth.user, 'update', 'automation', rule.id, rule.name)
  return NextResponse.json(rule)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const db = serviceRole()
  const { data: rule } = await db.from('automation_rules').select('name').eq('id', params.id).single()
  const { error } = await db.from('automation_rules').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  await logActivity(auth.user, 'delete', 'automation', params.id, rule?.name)
  return NextResponse.json({ ok: true })
}
