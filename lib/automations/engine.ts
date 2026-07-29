import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRole } from '@/lib/apiAuth'
import { notifyUsers } from '@/lib/notify'
import type { AutomationCondition, AutomationContext, AutomationTrigger } from './types'

const valueAt = (context: AutomationContext, field: string) => {
  if (field === 'client_id') return context.clientId
  if (field === 'project_id') return context.projectId
  if (field === 'entity_type') return context.entityType
  return context.values?.[field]
}

const conditionsPass = (conditions: AutomationCondition[], context: AutomationContext) => conditions.every(condition => {
  const current = valueAt(context, condition.field)
  if (condition.operator === 'is_set') return current !== null && current !== undefined && current !== ''
  if (condition.operator === 'contains') return String(current ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase())
  if (condition.operator === 'not_equals') return String(current ?? '') !== String(condition.value ?? '')
  return String(current ?? '') === String(condition.value ?? '')
})

const interpolate = (input: unknown, context: AutomationContext) => {
  if (typeof input !== 'string') return input
  const values: Record<string, unknown> = {
    entity_id: context.entityId, client_id: context.clientId, project_id: context.projectId,
    ...context.values,
  }
  return input.replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => String(values[key] ?? ''))
}

async function executeAction(db: SupabaseClient, action: any, context: AutomationContext) {
  const config = action.config ?? {}
  if (action.action_type === 'create_task') {
    const due = new Date()
    due.setDate(due.getDate() + Math.max(0, Number(config.due_in_days ?? 0)))
    const { data, error } = await db.from('tasks').insert({
      title: interpolate(config.title || 'Automated follow-up', context),
      description: interpolate(config.description || null, context),
      client_id: context.clientId ?? null,
      project_id: context.projectId ?? null,
      assigned_to: config.assigned_to || null,
      created_by: context.actorId ?? null,
      priority: config.priority || 'medium',
      due_date: config.due_in_days === '' || config.due_in_days == null ? null : due.toISOString().slice(0, 10),
    }).select('id, title').single()
    if (error) throw error
    if (config.assigned_to) await notifyUsers(db, {
      userIds: [config.assigned_to], title: 'New automated task assigned', body: data.title,
      href: '/tasks', category: 'task_assignment', entityType: 'task', entityId: data.id, actions: ['complete', 'reply'],
    })
    return { entity_type: 'task', entity_id: data.id, label: data.title }
  }

  if (action.action_type === 'send_notification') {
    let ids: string[] = Array.isArray(config.recipient_ids) ? config.recipient_ids : []
    if (Array.isArray(config.roles) && config.roles.length) {
      const { data } = await db.from('profiles').select('id').in('role', config.roles)
      ids = [...ids, ...(data ?? []).map((profile: any) => profile.id)]
    }
    await notifyUsers(db, {
      userIds: ids, title: String(interpolate(config.title || 'Automation update', context)),
      body: String(interpolate(config.body || '', context)), href: config.href || '/dashboard', category: 'critical_alert',
    })
    return { recipients: new Set(ids).size }
  }

  if (action.action_type === 'start_onboarding') {
    if (!context.clientId) throw new Error('This event is not linked to a client')
    const { data: existing } = await db.from('onboarding_runs').select('id').eq('client_id', context.clientId).eq('status', 'active').maybeSingle()
    if (existing) return { skipped: true, reason: 'Client already has an active onboarding run', entity_id: existing.id }
    const { data: template, error: templateError } = await db.from('onboarding_templates')
      .select('id, name, steps:onboarding_template_steps(title, description, sort_order)')
      .eq('id', config.template_id).single()
    if (templateError || !template) throw new Error('Onboarding template was not found')
    const { data: run, error } = await db.from('onboarding_runs').insert({
      client_id: context.clientId, template_id: template.id, template_name: template.name, created_by: context.actorId ?? null,
    }).select('id').single()
    if (error) throw error
    const steps = (template.steps ?? []).map((step: any) => ({ ...step, run_id: run.id }))
    if (steps.length) {
      const { error: stepsError } = await db.from('onboarding_run_steps').insert(steps)
      if (stepsError) throw stepsError
    }
    return { entity_type: 'onboarding_run', entity_id: run.id, label: template.name }
  }

  if (action.action_type === 'create_project') {
    if (!context.clientId) throw new Error('This event is not linked to a client')
    const { data, error } = await db.from('projects').insert({
      client_id: context.clientId,
      name: interpolate(config.name || '{{client_name}} — New project', context),
      description: interpolate(config.description || null, context),
      status: config.status || 'active',
    }).select('id, name').single()
    if (error) throw error
    return { entity_type: 'project', entity_id: data.id, label: data.name }
  }

  if (action.action_type === 'update_client_status') {
    if (!context.clientId) throw new Error('This event is not linked to a client')
    const { error } = await db.from('clients').update({ status: config.status || 'active' }).eq('id', context.clientId)
    if (error) throw error
    return { entity_type: 'client', entity_id: context.clientId, status: config.status || 'active' }
  }

  throw new Error(`Unsupported action: ${action.action_type}`)
}

export async function runAutomationEvent(triggerType: AutomationTrigger, context: AutomationContext, db = serviceRole(), onlyRuleId?: string) {
  let query = db.from('automation_rules')
    .select('*, actions:automation_actions(*)').eq('trigger_type', triggerType)
  query = onlyRuleId ? query.eq('id', onlyRuleId) : query.eq('is_active', true)
  const { data: rules, error } = await query
  if (error) {
    // Migration may not be live yet; product mutations must remain safe.
    if (/automation_rules/i.test(error.message)) return []
    throw error
  }

  const results = []
  for (const rule of rules ?? []) {
    const conditions = Array.isArray(rule.conditions) ? rule.conditions : []
    if (!conditionsPass(conditions, context)) continue
    const eventKey = context.eventKey ? `${triggerType}:${context.eventKey}` : null
    const { data: run, error: runError } = await db.from('automation_runs').insert({
      rule_id: rule.id, rule_name: rule.name, trigger_type: triggerType, event_key: eventKey,
      context, initiated_by: context.actorId ?? null,
    }).select('id').single()
    if (runError?.code === '23505') continue
    if (runError) throw runError

    const actionResults: any[] = []
    for (const action of [...(rule.actions ?? [])].sort((a: any, b: any) => a.sort_order - b.sort_order)) {
      try {
        actionResults.push({ action_id: action.id, action_type: action.action_type, status: 'succeeded', result: await executeAction(db, action, context) })
      } catch (actionError) {
        actionResults.push({ action_id: action.id, action_type: action.action_type, status: 'failed', error: actionError instanceof Error ? actionError.message : 'Action failed' })
      }
    }
    const failures = actionResults.filter(result => result.status === 'failed')
    const status = failures.length === 0 ? 'succeeded' : failures.length === actionResults.length ? 'failed' : 'partially_failed'
    const errorMessage = failures.map(result => result.error).join('; ') || null
    await db.from('automation_runs').update({ status, action_results: actionResults, error: errorMessage, finished_at: new Date().toISOString() }).eq('id', run.id)
    await db.from('automation_rules').update({
      last_run_at: new Date().toISOString(), last_error: errorMessage, run_count: Number(rule.run_count ?? 0) + 1,
    }).eq('id', rule.id)
    results.push({ rule_id: rule.id, run_id: run.id, status, actions: actionResults })
  }
  return results
}

export async function emitAutomationEvent(triggerType: AutomationTrigger, context: AutomationContext) {
  try { return await runAutomationEvent(triggerType, context) }
  catch (error) {
    console.error('[automations] event failed', triggerType, error)
    return []
  }
}
