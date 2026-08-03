export const AUTOMATION_TRIGGERS = [
  { value: 'client_created', label: 'Client is created', description: 'Runs after a new client is added.' },
  { value: 'lead_won', label: 'Lead is marked won', description: 'Runs the first time an open lead becomes won.' },
  { value: 'quotation_accepted', label: 'Quotation is accepted', description: 'Runs the first time a quotation becomes accepted.' },
  { value: 'invoice_paid', label: 'Invoice is paid', description: 'Runs the first time an invoice becomes fully paid.' },
  { value: 'task_completed', label: 'Task is completed', description: 'Runs when a task moves to Done.' },
  { value: 'project_completed', label: 'Project is completed', description: 'Runs when a project is completed.' },
  { value: 'creative_test_created', label: 'Creative test is created', description: 'Runs when Creative Lab opens a new experiment.' },
  { value: 'manual', label: 'Manual trigger', description: 'Runs only when an admin presses Run now.' },
] as const

export const AUTOMATION_ACTIONS = [
  { value: 'create_task', label: 'Create a task', description: 'Assign a task with a priority and due date.' },
  { value: 'send_notification', label: 'Notify team members', description: 'Send an in-app and email notification.' },
  { value: 'start_onboarding', label: 'Start onboarding checklist', description: 'Create a client onboarding run from a template.' },
  { value: 'create_project', label: 'Create a project', description: 'Open a project under the client.' },
  { value: 'update_client_status', label: 'Update client status', description: 'Move the client to onboarding, active, paused, or churned.' },
] as const

export type AutomationTrigger = typeof AUTOMATION_TRIGGERS[number]['value']
export type AutomationActionType = typeof AUTOMATION_ACTIONS[number]['value']
export type AutomationCondition = { field: string; operator: 'equals' | 'not_equals' | 'contains' | 'is_set'; value?: string }
export type AutomationActionDraft = { id?: string; action_type: AutomationActionType; config: Record<string, any>; sort_order?: number }

export type AutomationRuleDraft = {
  name: string
  description?: string | null
  trigger_type: AutomationTrigger
  trigger_config?: Record<string, any>
  conditions?: AutomationCondition[]
  is_active?: boolean
  actions: AutomationActionDraft[]
}

export type AutomationContext = {
  eventKey?: string
  actorId?: string | null
  entityId?: string | null
  entityType?: string | null
  clientId?: string | null
  projectId?: string | null
  values?: Record<string, any>
}
