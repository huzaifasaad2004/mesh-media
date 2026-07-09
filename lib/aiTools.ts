import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePeriod, ALL_PERIODS, type ReportPeriod } from '@/lib/reportPeriods'

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
    description: 'Get a live financial summary for a time period: revenue COLLECTED (paid invoices, counted on the date they were paid — not issued), outstanding balance (sent/overdue, all-time), total expenses in the period, net profit, active client count, and number of overdue invoices. Always pass a period — never assume "all time" unless the user says "ever" or "all time".',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ALL_PERIODS, description: 'this_week, this_month, last_month, this_quarter, this_year, or all_time. Default to this_month if the user does not specify.' },
      },
    },
  },
  {
    name: 'top_clients_by_revenue',
    description: 'Rank clients by how much paid revenue they generated in a given period. Use for "highest paying clients", "best clients", "who pays us the most" style questions.',
    parameters: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ALL_PERIODS, description: 'Defaults to this_month if not specified.' },
        limit: { type: 'number', description: 'How many clients to return, default 5' },
      },
    },
  },
  {
    name: 'get_client_statement',
    description: 'Get a client\'s full account statement: total invoiced, total paid, outstanding balance, and every invoice with its status and dates. Use for "account statement", "how much has X paid us", "does X owe us money".',
    parameters: {
      type: 'object',
      properties: { name: { type: 'string', description: 'Client company name, partial match ok' } },
      required: ['name'],
    },
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
  {
    name: 'create_expense',
    description: 'Log a business expense. Use when the user tells you about money the agency spent, e.g. "log an expense of 500 AED for Facebook ads today".',
    parameters: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        amount: { type: 'number' },
        category: { type: 'string', enum: ['software', 'ads', 'freelancer', 'office', 'travel', 'other'] },
        date: { type: 'string', description: 'YYYY-MM-DD, defaults to today if not stated' },
        client_name: { type: 'string', description: 'Optional — if this expense is billable to a specific client' },
      },
      required: ['description', 'amount'],
    },
  },
]

// ─── Executors ─────────────────────────────────────────────────
export async function executeTool(name: string, args: any, ctx: ToolContext): Promise<any> {
  const { db, role } = ctx
  switch (name) {
    case 'get_financials': {
      const period: ReportPeriod = ALL_PERIODS.includes(args.period) ? args.period : 'this_month'
      const { start, end } = resolvePeriod(period)

      // Revenue is pre-VAT (total minus tax_amount) — VAT collected isn't agency income.
      let paidQuery = db.from('invoices').select('total, tax_amount').eq('status', 'paid')
      if (start) paidQuery = paidQuery.gte('paid_date', start)
      if (end) paidQuery = paidQuery.lte('paid_date', end)
      let expenseQuery = db.from('expenses').select('amount')
      if (start) expenseQuery = expenseQuery.gte('date', start)
      if (end) expenseQuery = expenseQuery.lte('date', end)

      const [{ data: paidInvoices }, { data: allInvoices }, { data: clients }, { data: expenses }] = await Promise.all([
        paidQuery,
        db.from('invoices').select('status, total, amount_paid'),
        db.from('clients').select('status'),
        expenseQuery,
      ])
      const paid = (paidInvoices ?? []).reduce((s, i) => s + (Number(i.total) - Number(i.tax_amount ?? 0)), 0)
      const outstanding = (allInvoices ?? []).filter(i => ['sent', 'overdue', 'partially_paid'].includes(i.status)).reduce((s, i: any) => s + (Number(i.total ?? 0) - Number(i.amount_paid ?? 0)), 0)
      const totalExp = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
      return {
        period,
        revenue_collected: paid,
        outstanding_all_time: outstanding,
        expenses_in_period: totalExp,
        net_profit_for_period: paid - totalExp,
        active_clients: (clients ?? []).filter(c => c.status === 'active').length,
        overdue_invoices: (allInvoices ?? []).filter(i => i.status === 'overdue').length,
        currency: 'AED',
      }
    }

    case 'top_clients_by_revenue': {
      const period: ReportPeriod = ALL_PERIODS.includes(args.period) ? args.period : 'this_month'
      const { start, end } = resolvePeriod(period)
      let q = db.from('invoices').select('total, tax_amount, client:clients(company_name)').eq('status', 'paid')
      if (start) q = q.gte('paid_date', start)
      if (end) q = q.lte('paid_date', end)
      const { data } = await q
      const byClient = new Map<string, number>()
      for (const inv of data ?? []) {
        const name = (inv as any).client?.company_name ?? 'Unknown'
        byClient.set(name, (byClient.get(name) ?? 0) + (Number(inv.total) - Number(inv.tax_amount ?? 0)))
      }
      const limit = Number(args.limit) || 5
      return {
        period,
        top_clients: Array.from(byClient.entries())
          .map(([name, total]) => ({ client: name, revenue: total }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, limit),
      }
    }

    case 'get_client_statement': {
      const { data: client } = await db.from('clients').select('id, company_name').ilike('company_name', `%${args.name}%`).limit(1).maybeSingle()
      if (!client) return { found: false, message: `No client matching "${args.name}"` }
      const { data: invoices } = await db.from('invoices').select('invoice_number, status, total, amount_paid, issue_date, due_date, paid_date').eq('client_id', client.id).order('issue_date', { ascending: false })
      const totalInvoiced = (invoices ?? []).reduce((s, i) => s + Number(i.total), 0)
      const totalPaid = (invoices ?? []).reduce((s, i) => s + Number(i.status === 'paid' ? i.total : i.amount_paid ?? 0), 0)
      const outstandingBalance = (invoices ?? []).filter(i => ['sent', 'overdue', 'partially_paid'].includes(i.status)).reduce((s, i) => s + (Number(i.total) - Number(i.amount_paid ?? 0)), 0)
      return {
        found: true,
        company_name: client.company_name,
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        outstanding_balance: outstandingBalance,
        invoices: invoices ?? [],
      }
    }

    case 'list_overdue_invoices': {
      const { data } = await db
        .from('invoices')
        .select('invoice_number, total, amount_paid, status, due_date, client:clients(company_name)')
        .in('status', ['sent', 'overdue', 'partially_paid'])
        .order('due_date', { ascending: true })
      return (data ?? []).map((i: any) => ({
        invoice_number: i.invoice_number,
        client: i.client?.company_name ?? 'Unknown',
        amount: Number(i.total) - Number(i.amount_paid ?? 0),
        due_date: i.due_date,
        status: i.status,
      }))
    }

    case 'find_client': {
      const { data: client } = await db.from('clients').select('*').ilike('company_name', `%${args.name}%`).limit(1).maybeSingle()
      if (!client) return { found: false, message: `No client matching "${args.name}"` }
      const [{ data: invoices }, { data: projects }] = await Promise.all([
        db.from('invoices').select('invoice_number, total, status').eq('client_id', client.id).in('status', ['sent', 'overdue', 'draft', 'partially_paid']),
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

    case 'create_expense': {
      if (!canWriteOps(role)) return { error: 'You do not have permission to log expenses.' }
      let client_id = null
      const notes: string[] = []
      if (args.client_name) {
        const { data } = await db.from('clients').select('id').ilike('company_name', `%${args.client_name}%`).limit(1).maybeSingle()
        if (data) client_id = data.id; else notes.push(`client "${args.client_name}" not found`)
      }
      const { data, error } = await db.from('expenses').insert({
        description: args.description,
        amount: Number(args.amount),
        category: ['software', 'ads', 'freelancer', 'office', 'travel', 'other'].includes(args.category) ? args.category : 'other',
        date: args.date || today(),
        client_id,
      }).select('id, description, amount').single()
      if (error) return { error: error.message }
      return { created: true, expense_id: data.id, description: data.description, amount: data.amount, notes }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// Tools that change data — used by the UI to know when to suggest a refresh
export const WRITE_TOOLS = ['create_task', 'create_client', 'create_expense']
