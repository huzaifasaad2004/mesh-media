import type { SupabaseClient } from '@supabase/supabase-js'
import { resolvePeriod, ALL_PERIODS, type ReportPeriod } from '@/lib/reportPeriods'
import { generateEmbedding, toVectorLiteral } from '@/lib/ai/embeddings'

export interface ToolContext {
  /** RLS-scoped client, authenticated as the caller — every read tool uses
   *  this, so a 'member' automatically only ever sees clients/projects/tasks
   *  they're actually assigned to. Never swap this for a service-role client. */
  db: SupabaseClient
  /** Service-role client — used only for the handful of write tools, after
   *  the same manual role check every other write route in the app does. */
  writeDb: SupabaseClient
  role: string
  userId: string
}

const canWriteOps = (role: string) => ['owner', 'admin', 'manager', 'member'].includes(role)
const canWriteClients = (role: string) => ['owner', 'admin', 'manager'].includes(role)
const canWriteLeads = (role: string) => ['owner', 'admin', 'manager'].includes(role)

const today = () => new Date().toISOString().split('T')[0]

async function cashReceiptsFor(db: SupabaseClient, start: string | null, end: string | null) {
  let paymentQuery = db.from('invoice_payments').select('invoice_id, amount, payment_date, invoice:invoices(total, tax_amount, client:clients(company_name))')
  let legacyQuery = db.from('invoices').select('id, total, tax_amount, paid_date, client:clients(company_name), payments:invoice_payments(id)').eq('status', 'paid')
  if (start) { paymentQuery = paymentQuery.gte('payment_date', start); legacyQuery = legacyQuery.gte('paid_date', start) }
  if (end) { paymentQuery = paymentQuery.lte('payment_date', end); legacyQuery = legacyQuery.lte('paid_date', end) }
  const [payments, legacyInvoices] = await Promise.all([paymentQuery, legacyQuery])
  if (payments.error) throw payments.error
  if (legacyInvoices.error) throw legacyInvoices.error
  const one = (value: any) => Array.isArray(value) ? value[0] : value
  return [
    ...(payments.data ?? []).map((payment: any) => {
      const invoice = one(payment.invoice)
      const total = Number(invoice?.total ?? 0)
      const ratio = total > 0 ? Math.max(0, total - Number(invoice?.tax_amount ?? 0)) / total : 1
      return { amount: Number(payment.amount ?? 0) * ratio, client: one(invoice?.client)?.company_name ?? 'Unknown' }
    }),
    ...(legacyInvoices.data ?? []).filter((invoice: any) => (invoice.payments?.length ?? 0) === 0).map((invoice: any) => ({
      amount: Math.max(0, Number(invoice.total ?? 0) - Number(invoice.tax_amount ?? 0)),
      client: one(invoice.client)?.company_name ?? 'Unknown',
    })),
  ]
}

// ─── Gemini function declarations ──────────────────────────────
export const toolDeclarations = [
  {
    name: 'get_financials',
    description: 'Get a live financial summary for a time period: cash COLLECTED (full and partial invoice payments, counted on the date received — not issued), outstanding balance (sent/overdue/partially paid, all-time), total expenses in the period, AED net result, active client count, and number of overdue invoices. Always pass a period — never assume "all time" unless the user says "ever" or "all time".',
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
  {
    name: 'search_leads',
    description: 'Search the CRM pipeline for leads (prospects who are not yet clients). Use for "what leads do we have", "any leads from Instagram", "who\'s in negotiation", "show me open leads". Not for existing clients — use find_client for those.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Optional partial match on company or contact name' },
        status: { type: 'string', enum: ['open', 'won', 'lost'], description: 'Defaults to open if not specified' },
        stage_name: { type: 'string', description: 'Optional pipeline stage name, partial match ok (e.g. "Negotiation")' },
        due_follow_ups_only: { type: 'boolean', description: 'Only leads whose next follow-up is today or overdue' },
      },
    },
  },
  {
    name: 'create_lead',
    description: 'Add a new prospect to the CRM pipeline. Use whenever the user mentions a new potential client/lead in conversation, e.g. "add a lead: spoke to Fatima at Nova Realty at the expo, quote her 8k/mo social". Resolve stage/assignee by name if mentioned; otherwise the lead lands in the first pipeline stage unassigned.',
    parameters: {
      type: 'object',
      properties: {
        company_name: { type: 'string' },
        contact_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        source: { type: 'string', enum: ['referral', 'instagram', 'website', 'cold_outreach', 'event', 'existing_network', 'other'] },
        estimated_value: { type: 'number', description: 'Estimated deal value in AED' },
        next_follow_up: { type: 'string', description: 'YYYY-MM-DD, convert relative dates like "next Tuesday" using today\'s date' },
        stage_name: { type: 'string', description: 'Optional pipeline stage to place it in, partial match ok' },
        assignee_name: { type: 'string', description: 'Optional teammate to assign it to' },
        notes: { type: 'string' },
      },
      required: ['company_name'],
    },
  },
  {
    name: 'log_lead_activity',
    description: 'Log a note, call, meeting, email, or WhatsApp touch against an existing lead\'s activity timeline. Use when the user reports contact with a prospect, e.g. "log that I called Nova Realty, they want a proposal by Friday".',
    parameters: {
      type: 'object',
      properties: {
        lead_name: { type: 'string', description: 'Company name of the lead, partial match ok' },
        type: { type: 'string', enum: ['note', 'call', 'meeting', 'email', 'whatsapp'], description: 'Defaults to note if not specified' },
        note: { type: 'string' },
      },
      required: ['lead_name', 'note'],
    },
  },
  {
    name: 'search_knowledge',
    description: 'Semantic search across clients, projects, tasks, client notes, and published knowledge-base/SOP articles — use this for open-ended questions the other tools don\'t directly answer, e.g. "what have we discussed with X about their rebrand", "find anything related to the Ramadan campaign", "which clients are in the F&B industry", "what\'s our SOP for onboarding a new client", "how do we handle a refund request". Returns the most relevant matches with a similarity score.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A natural-language description of what to find' },
      },
      required: ['query'],
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

      let expenseQuery = db.from('expenses').select('amount')
      let payrollQuery = db.from('salary_payments').select('amount, salary:salaries(currency)')
      if (start) expenseQuery = expenseQuery.gte('date', start)
      if (end) expenseQuery = expenseQuery.lte('date', end)
      if (start) payrollQuery = payrollQuery.gte('payment_date', start)
      if (end) payrollQuery = payrollQuery.lte('payment_date', end)

      const [receipts, { data: allInvoices }, { data: clients }, { data: expenses }, { data: payrollPayments }] = await Promise.all([
        cashReceiptsFor(db, start, end),
        db.from('invoices').select('status, total, amount_paid'),
        db.from('clients').select('status'),
        expenseQuery,
        payrollQuery,
      ])
      const paid = receipts.reduce((sum, receipt) => sum + receipt.amount, 0)
      const outstanding = (allInvoices ?? []).filter(i => ['sent', 'overdue', 'partially_paid'].includes(i.status)).reduce((s, i: any) => s + (Number(i.total ?? 0) - Number(i.amount_paid ?? 0)), 0)
      const totalExp = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0)
      const payrollByCurrency = (payrollPayments ?? []).reduce<Record<string, number>>((totals, payment: any) => {
        const salary = Array.isArray(payment.salary) ? payment.salary[0] : payment.salary
        const currency = salary?.currency ?? 'AED'
        totals[currency] = (totals[currency] ?? 0) + Number(payment.amount ?? 0)
        return totals
      }, {})
      return {
        period,
        revenue_collected: paid,
        outstanding_all_time: outstanding,
        expenses_in_period: totalExp,
        payroll_paid_in_period: payrollByCurrency,
        net_cash_result_aed: paid - totalExp - (payrollByCurrency.AED ?? 0),
        active_clients: (clients ?? []).filter(c => c.status === 'active').length,
        overdue_invoices: (allInvoices ?? []).filter(i => i.status === 'overdue').length,
        currency: 'AED',
      }
    }

    case 'top_clients_by_revenue': {
      const period: ReportPeriod = ALL_PERIODS.includes(args.period) ? args.period : 'this_month'
      const { start, end } = resolvePeriod(period)
      const receipts = await cashReceiptsFor(db, start, end)
      const byClient = new Map<string, number>()
      for (const receipt of receipts) {
        byClient.set(receipt.client, (byClient.get(receipt.client) ?? 0) + receipt.amount)
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
      const { data: task, error } = await ctx.writeDb.from('tasks').insert({
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
      const { data, error } = await ctx.writeDb.from('clients').insert({
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
      const { data, error } = await ctx.writeDb.from('expenses').insert({
        description: args.description,
        amount: Number(args.amount),
        category: ['software', 'ads', 'freelancer', 'office', 'travel', 'other'].includes(args.category) ? args.category : 'other',
        date: args.date || today(),
        client_id,
      }).select('id, description, amount').single()
      if (error) return { error: error.message }
      return { created: true, expense_id: data.id, description: data.description, amount: data.amount, notes }
    }

    case 'search_leads': {
      let q = db.from('leads').select('company_name, contact_name, source, estimated_value, currency, status, next_follow_up, stage:pipeline_stages(name), assignee:profiles!leads_assigned_to_fkey(full_name)')
      q = q.eq('status', ['open', 'won', 'lost'].includes(args.status) ? args.status : 'open')
      if (args.due_follow_ups_only) q = q.lte('next_follow_up', today())
      const { data } = await q.order('next_follow_up', { ascending: true, nullsFirst: false }).limit(40)
      let rows = (data ?? []) as any[]
      if (args.query) {
        const n = args.query.toLowerCase()
        rows = rows.filter(l => l.company_name?.toLowerCase().includes(n) || l.contact_name?.toLowerCase().includes(n))
      }
      if (args.stage_name) {
        const n = args.stage_name.toLowerCase()
        rows = rows.filter(l => l.stage?.name?.toLowerCase().includes(n))
      }
      return rows.map((l: any) => ({
        company_name: l.company_name, contact_name: l.contact_name, source: l.source,
        estimated_value: l.estimated_value, currency: l.currency, status: l.status,
        stage: l.stage?.name ?? null, next_follow_up: l.next_follow_up,
        assignee: l.assignee?.full_name ?? 'Unassigned',
      }))
    }

    case 'create_lead': {
      if (!canWriteLeads(role)) return { error: 'You do not have permission to add leads.' }
      let stage_id = null, assigned_to = null
      const notes: string[] = []
      if (args.stage_name) {
        const { data } = await db.from('pipeline_stages').select('id').ilike('name', `%${args.stage_name}%`).limit(1).maybeSingle()
        if (data) stage_id = data.id; else notes.push(`stage "${args.stage_name}" not found`)
      }
      if (!stage_id) {
        const { data: first } = await db.from('pipeline_stages').select('id').order('position').limit(1).maybeSingle()
        stage_id = first?.id ?? null
      }
      if (args.assignee_name) {
        const { data } = await db.from('profiles').select('id').ilike('full_name', `%${args.assignee_name}%`).limit(1).maybeSingle()
        if (data) assigned_to = data.id; else notes.push(`teammate "${args.assignee_name}" not found`)
      }
      const { data: lead, error } = await ctx.writeDb.from('leads').insert({
        company_name: args.company_name,
        contact_name: args.contact_name || null,
        email: args.email || null,
        phone: args.phone || null,
        source: ['referral', 'instagram', 'website', 'cold_outreach', 'event', 'existing_network', 'other'].includes(args.source) ? args.source : 'other',
        estimated_value: args.estimated_value != null ? Number(args.estimated_value) : null,
        next_follow_up: args.next_follow_up || null,
        notes: args.notes || null,
        stage_id, assigned_to,
        created_by: ctx.userId,
      }).select('id, company_name').single()
      if (error) return { error: error.message }
      return { created: true, lead_id: lead.id, company_name: lead.company_name, notes }
    }

    case 'log_lead_activity': {
      if (!canWriteLeads(role)) return { error: 'You do not have permission to log lead activity.' }
      const { data: lead } = await db.from('leads').select('id, company_name').ilike('company_name', `%${args.lead_name}%`).limit(1).maybeSingle()
      if (!lead) return { error: `No lead matching "${args.lead_name}"` }
      const type = ['note', 'call', 'meeting', 'email', 'whatsapp'].includes(args.type) ? args.type : 'note'
      const { error } = await ctx.writeDb.from('lead_activities').insert({
        lead_id: lead.id, type, note: args.note, created_by: ctx.userId,
      })
      if (error) return { error: error.message }
      return { created: true, logged: true, lead: lead.company_name, type }
    }

    case 'search_knowledge': {
      if (!args.query?.trim()) return { error: 'query is required' }
      let queryEmbedding: number[]
      try {
        queryEmbedding = await generateEmbedding(args.query)
      } catch (e: any) {
        return { error: `Embedding failed: ${e.message}` }
      }
      // RPC runs SECURITY INVOKER as ctx.db's authenticated user, so RLS on
      // the embeddings table still scopes results — a member never gets a
      // match for a client they can't otherwise see.
      const { data, error } = await db.rpc('match_embeddings', {
        query_embedding: toVectorLiteral(queryEmbedding),
        match_count: 8,
      })
      if (error) return { error: error.message }
      return { matches: (data ?? []).map((m: any) => ({ type: m.entity_type, content: m.content, relevance: Number(m.similarity).toFixed(2) })) }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

// Tools that change data — used by the UI to know when to suggest a refresh
export const WRITE_TOOLS = ['create_task', 'create_client', 'create_expense', 'create_lead', 'log_lead_activity']
