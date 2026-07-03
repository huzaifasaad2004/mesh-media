import type { SupabaseClient } from '@supabase/supabase-js'

export interface ToolContext {
  db: SupabaseClient
  role: string
  userId: string
}

const canWriteOps = (role: string) => ['owner', 'admin', 'manager', 'member'].includes(role)
const canWriteClients = (role: string) => ['owner', 'admin', 'manager'].includes(role)

const today = () => new Date().toISOString().split('T')[0]

// ─── Gemini function declarations ──────────────────────────────
export const toolDeclarations = [
  {
    name: 'get_financials',
    description: 'Get a live financial summary: revenue collected (paid invoices), outstanding (sent/overdue), total expenses, net profit, active client count, and number of overdue invoices. Use for any money/revenue/profit question.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'list_overdue_invoices',
    description: 'List invoices that are overdue or unpaid (status sent or overdue), with client name, amount and due date. Use when asked who owes money or what to chase.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'find_client',
    description: 'Look up a client by (partial) company name and return their details plus their open invoices and active projects.',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Full or partial company name' } },
      required: ['name'],
    },
  },
  {
    name: 'list_tasks',
    description: 'List tasks, optionally filtered. Use for questions about what work is open, overdue tasks, or a person\'s tasks.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'in_progress', 'review', 'done'], description: 'Optional status filter' },
        overdue_only: { type: 'boolean', description: 'Only tasks past their due date and not done' },
        assignee_name: { type: 'string', description: 'Optional assignee full name (partial ok)' },
      },
    },
  },
  {
    name: 'list_projects',
    description: 'List projects with their client, status and task-completion progress.',
    parameters: {
      type: 'object',
      properties: { active_only: { type: 'boolean', description: 'Only active projects' } },
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task. Resolve people/clients/projects by name. Pass due_date as an absolute YYYY-MM-DD date (convert relative dates like "Friday" using today\'s date given in the system prompt).',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
        client_name: { type: 'string' },
        project_name: { type: 'string' },
        assignee_name: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_client',
    description: 'Create a new client company record.',
    parameters: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        email: { type: 'string' },
        industry: { type: 'string' },
      },
      required: ['company_name'],
    },
  },
]

// ─── Executors ─────────────────────────────────────────────────
export async function executeTool(name: string, args: any, ctx: ToolContext): Promise<any> {
  const { db, role } = ctx
  switch (name) {
    case 'get_financials': {
      const [{ data: invoices }, { data: clients }, { data: expenses }] = await Promise.all([
        db.from('invoices').select('total, status'),
        db.from('clients').select('status'),
        db.from('expenses').select('amount'),
      ])
      const paid = (invoices ?? []).filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.total), 0)
      const outstanding = (invoices ?? []).filter(i => ['sent', 'overdue'].includes(i.status)).reduce((s, i) => s + Number(i.total), 0)
      const totalExp = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
      return {
        revenue_collected: paid,
        outstanding,
        total_expenses: totalExp,
        net_profit: paid - totalExp,
        active_clients: (clients ?? []).filter(c => c.status === 'active').length,
        overdue_invoices: (invoices ?? []).filter(i => i.status === 'overdue').length,
        currency: 'AED',
      }
    }

    case 'list_overdue_invoices': {
      const { data } = await db
        .from('invoices')
        .select('invoice_number, total, status, due_date, client:clients(company_name)')
        .in('status', ['sent', 'overdue'])
        .order('due_date', { ascending: true })
      return (data ?? []).map((i: any) => ({
        invoice_number: i.invoice_number,
        client: i.client?.company_name ?? 'Unknown',
        amount: Number(i.total),
        due_date: i.due_date,
        status: i.status,
      }))
    }

    case 'find_client': {
      const { data: client } = await db.from('clients').select('*').ilike('company_name', `%${args.name}%`).limit(1).maybeSingle()
      if (!client) return { found: false, message: `No client matching "${args.name}"` }
      const [{ data: invoices }, { data: projects }] = await Promise.all([
        db.from('invoices').select('invoice_number, total, status').eq('client_id', client.id).in('status', ['sent', 'overdue', 'draft']),
        db.from('projects').select('name, status').eq('client_id', client.id),
      ])
      return {
        found: true,
        company_name: client.company_name,
        status: client.status,
        email: client.email,
        phone: client.phone,
        monthly_retainer: client.monthly_retainer,
        open_invoices: invoices ?? [],
        projects: projects ?? [],
      }
    }

    case 'list_tasks': {
      let q = db.from('tasks').select('title, status, priority, due_date, assignee:profiles!tasks_assigned_to_fkey(full_name), client:clients(company_name)')
      if (args.status) q = q.eq('status', args.status)
      if (args.overdue_only) q = q.lt('due_date', today()).neq('status', 'done')
      const { data } = await q.order('due_date', { ascending: true }).limit(40)
      let rows = (data ?? []) as any[]
      if (args.assignee_name) {
        const n = args.assignee_name.toLowerCase()
        rows = rows.filter(t => t.assignee?.full_name?.toLowerCase().includes(n))
      }
      return rows.map((t: any) => ({
        title: t.title, status: t.status, priority: t.priority, due_date: t.due_date,
        assignee: t.assignee?.full_name ?? 'Unassigned', client: t.client?.company_name ?? null,
      }))
    }

    case 'list_projects': {
      let q = db.from('projects').select('name, status, client:clients(company_name), tasks(status)')
      if (args.active_only) q = q.eq('status', 'active')
      const { data } = await q.order('created_at', { ascending: false }).limit(30)
      return (data ?? []).map((p: any) => {
        const tasks = p.tasks ?? []
        const done = tasks.filter((t: any) => t.status === 'done').length
        return {
          name: p.name, status: p.status, client: p.client?.company_name ?? 'Internal',
          progress_percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
          open_tasks: tasks.filter((t: any) => t.status !== 'done').length,
        }
      })
    }

    case 'create_task': {
      if (!canWriteOps(role)) return { error: 'You do not have permission to create tasks.' }
      let client_id = null, project_id = null, assigned_to = null
      const notes: string[] = []
      if (args.client_name) {
        const { data } = await db.from('clients').select('id').ilike('company_name', `%${args.client_name}%`).limit(1).maybeSingle()
        if (data) client_id = data.id; else notes.push(`client "${args.client_name}" not found`)
      }
      if (args.project_name) {
        const { data } = await db.from('projects').select('id').ilike('name', `%${args.project_name}%`).limit(1).maybeSingle()
        if (data) project_id = data.id; else notes.push(`project "${args.project_name}" not found`)
      }
      if (args.assignee_name) {
        const { data } = await db.from('profiles').select('id').ilike('full_name', `%${args.assignee_name}%`).limit(1).maybeSingle()
        if (data) assigned_to = data.id; else notes.push(`teammate "${args.assignee_name}" not found`)
      }
      const { data: task, error } = await db.from('tasks').insert({
        title: args.title,
        due_date: args.due_date || null,
        priority: args.priority || 'medium',
        status: 'todo',
        client_id, project_id, assigned_to,
        created_by: ctx.userId,
      }).select('id, title').single()
      if (error) return { error: error.message }
      return { created: true, task_id: task.id, title: task.title, notes }
    }

    case 'create_client': {
      if (!canWriteClients(role)) return { error: 'You do not have permission to create clients.' }
      const { data, error } = await db.from('clients').insert({
        company_name: args.company_name,
        email: args.email || null,
        industry: args.industry || null,
        status: 'lead',
      }).select('id, company_name').single()
      if (error) return { error: error.message }
      return { created: true, client_id: data.id, company_name: data.company_name }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// Tools that change data — used by the UI to know when to suggest a refresh
export const WRITE_TOOLS = ['create_task', 'create_client']
