import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'
import { logActivity } from '@/lib/activityLog'
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, type AutomationRuleDraft } from '@/lib/automations/types'

const triggerTypes = new Set(AUTOMATION_TRIGGERS.map(item => item.value))
const actionTypes = new Set(AUTOMATION_ACTIONS.map(item => item.value))

function validate(body: AutomationRuleDraft) {
  if (!body.name?.trim()) return 'Workflow name is required'
  if (!triggerTypes.has(body.trigger_type)) return 'Choose a valid trigger'
  if (!Array.isArray(body.actions) || body.actions.length === 0) return 'Add at least one action'
  if (body.actions.some(action => !actionTypes.has(action.action_type))) return 'One of the actions is not supported'
  return null
}

export async function GET() {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const db = serviceRole()
  const [{ data: rules, error }, { data: runs }, { data: profiles }, { data: templates }, { data: clients }] = await Promise.all([
    db.from('automation_rules').select('*, actions:automation_actions(*)').order('created_at', { ascending: false }),
    db.from('automation_runs').select('*').order('started_at', { ascending: false }).limit(100),
    db.from('profiles').select('id, full_name, email, role').neq('role', 'client').order('full_name'),
    db.from('onboarding_templates').select('id, name').order('name'),
    db.from('clients').select('id, company_name').order('company_name'),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({
    rules: (rules ?? []).map((rule: any) => ({ ...rule, actions: [...(rule.actions ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order) })),
    runs: runs ?? [], profiles: profiles ?? [], templates: templates ?? [], clients: clients ?? [],
  })
}

export async function POST(req: NextRequest) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const body = await req.json() as AutomationRuleDraft
  const validationError = validate(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  const db = serviceRole()
  const { data: rule, error } = await db.from('automation_rules').insert({
    name: body.name.trim(), description: body.description?.trim() || null,
    trigger_type: body.trigger_type, trigger_config: body.trigger_config ?? {},
    conditions: body.conditions ?? [], is_active: !!body.is_active, created_by: auth.user.id,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  const { error: actionError } = await db.from('automation_actions').insert(body.actions.map((action, index) => ({
    rule_id: rule.id, action_type: action.action_type, config: action.config ?? {}, sort_order: index,
  })))
  if (actionError) {
    await db.from('automation_rules').delete().eq('id', rule.id)
    return NextResponse.json({ error: actionError.message }, { status: 400 })
  }
  await logActivity(auth.user, 'create', 'automation', rule.id, rule.name)
  return NextResponse.json(rule, { status: 201 })
}
