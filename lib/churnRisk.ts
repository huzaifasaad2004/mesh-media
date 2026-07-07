export type ChurnLevel = 'healthy' | 'watch' | 'at_risk' | 'critical'

export interface ChurnInput {
  status: string
  monthlyRetainer: number | null
  invoices: { status: string; due_date: string | null; issue_date: string }[]
  lastTaskAt: string | null
  lastNoteAt: string | null
}

export interface ChurnResult {
  score: number
  level: ChurnLevel
  reasons: string[]
}

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))

const levelFor = (score: number): ChurnLevel =>
  score >= 80 ? 'healthy' : score >= 60 ? 'watch' : score >= 35 ? 'at_risk' : 'critical'

/** Rule-based, explainable health score — not ML, but transparent and cheap
 *  to compute from data we already have (invoices, tasks, notes). */
export function computeChurnRisk(input: ChurnInput): ChurnResult {
  let score = 100
  const reasons: string[] = []

  if (input.status === 'paused') {
    score -= 30
    reasons.push('Account is paused')
  }

  const overdue = input.invoices.filter((i) => i.status === 'overdue')
  if (overdue.length > 0) {
    const maxDaysOverdue = Math.max(...overdue.map((i) => (i.due_date ? daysSince(i.due_date) : 0)))
    const penalty = Math.min(40, overdue.length * 10 + Math.floor(maxDaysOverdue / 7) * 5)
    score -= penalty
    reasons.push(`${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''} (up to ${maxDaysOverdue} days late)`)
  }

  if (input.monthlyRetainer && input.monthlyRetainer > 0 && input.invoices.length === 0) {
    score -= 15
    reasons.push('No invoices in the last 6 months despite an active retainer')
  }

  const taskGapDays = input.lastTaskAt ? daysSince(input.lastTaskAt) : null
  if (taskGapDays === null) {
    score -= 20
    reasons.push('No task activity on record')
  } else if (taskGapDays > 60) {
    score -= 20
    reasons.push(`No task activity in ${taskGapDays} days`)
  } else if (taskGapDays > 30) {
    score -= 10
    reasons.push(`No task activity in ${taskGapDays} days`)
  }

  const noteGapDays = input.lastNoteAt ? daysSince(input.lastNoteAt) : null
  if (noteGapDays === null || noteGapDays > 90) {
    score -= 10
    reasons.push('No client notes or contact logged in 90+ days')
  }

  score = Math.max(0, Math.min(100, score))

  if (reasons.length === 0) reasons.push('No risk factors detected')

  return { score, level: levelFor(score), reasons }
}

export const CHURN_LEVEL_LABEL: Record<ChurnLevel, string> = {
  healthy: 'Healthy',
  watch: 'Watch',
  at_risk: 'At Risk',
  critical: 'Critical',
}

export const CHURN_LEVEL_COLOR: Record<ChurnLevel, string> = {
  healthy: 'bg-green-50 text-green-700',
  watch: 'bg-[#F6ECD6] text-[#8a6116]',
  at_risk: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
}
