import { serviceRole } from '@/lib/apiAuth'

export interface ClientReportStats {
  tasksCompleted: number
  hoursLogged: number
  revenue: number
  deliverables: string[]
  activeProjects: number
}

/** period is 'YYYY-MM'. Mirrors the revenue-recognition convention used
 *  elsewhere in this app (see app/api/invoices/[id]/route.ts): revenue is
 *  keyed off paid_date, not issue_date or status alone. */
export async function computeClientStats(
  db: ReturnType<typeof serviceRole>,
  clientId: string,
  period: string
): Promise<ClientReportStats> {
  const periodStart = `${period}-01`
  const periodEnd = new Date(`${period}-01T00:00:00Z`)
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + 1)
  const periodEndStr = periodEnd.toISOString().split('T')[0]

  const [{ count: tasksCompleted }, { data: timeEntries }, { data: invoices }, { data: projects }] = await Promise.all([
    db.from('tasks').select('id', { count: 'exact', head: true })
      .eq('client_id', clientId).eq('status', 'done')
      .gte('updated_at', periodStart).lt('updated_at', periodEndStr),
    db.from('time_entries').select('minutes')
      .eq('client_id', clientId)
      .gte('entry_date', periodStart).lt('entry_date', periodEndStr),
    db.from('invoices').select('total')
      .eq('client_id', clientId).eq('status', 'paid')
      .gte('paid_date', periodStart).lt('paid_date', periodEndStr),
    db.from('projects').select('id, status').eq('client_id', clientId),
  ])

  // milestones has no "done at" timestamp, only created_at (when it was
  // added, not when it was completed) — so we can't reliably scope "done
  // this month". Report all currently-done milestones for the client's
  // projects instead of a misleading date-filtered subset.
  const projectIds = (projects ?? []).map((p) => p.id)
  let deliverables: string[] = []
  if (projectIds.length > 0) {
    const { data: milestones } = await db.from('milestones')
      .select('title')
      .in('project_id', projectIds)
      .eq('done', true)
    deliverables = (milestones ?? []).map((m) => m.title)
  }

  return {
    tasksCompleted: tasksCompleted ?? 0,
    hoursLogged: Math.round(((timeEntries ?? []).reduce((s, t) => s + (t.minutes ?? 0), 0) / 60) * 10) / 10,
    revenue: (invoices ?? []).reduce((s, i) => s + (i.total ?? 0), 0),
    deliverables,
    activeProjects: (projects ?? []).filter((p) => p.status === 'active').length,
  }
}
