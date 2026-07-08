export type ReportPeriod = 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
  all_time: 'All Time',
}

const iso = (d: Date) => d.toISOString().split('T')[0]

/** Inclusive [start, end] date range (YYYY-MM-DD) for a named period. end=null means open-ended (all_time only) — current-period ranges are capped at today so future-dated rows never leak in. */
export function resolvePeriod(period: ReportPeriod, now = new Date()): { start: string | null; end: string | null } {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate()

  const today = iso(now)

  switch (period) {
    case 'this_week': {
      const day = (now.getDay() + 6) % 7 // Monday = 0
      const start = new Date(y, m, d - day)
      return { start: iso(start), end: today }
    }
    case 'this_month':
      return { start: iso(new Date(y, m, 1)), end: today }
    case 'last_month':
      return { start: iso(new Date(y, m - 1, 1)), end: iso(new Date(y, m, 0)) }
    case 'this_quarter': {
      const qStartMonth = Math.floor(m / 3) * 3
      return { start: iso(new Date(y, qStartMonth, 1)), end: today }
    }
    case 'this_year':
      return { start: iso(new Date(y, 0, 1)), end: today }
    case 'all_time':
    default:
      return { start: null, end: null }
  }
}

export const ALL_PERIODS: ReportPeriod[] = ['this_week', 'this_month', 'last_month', 'this_quarter', 'this_year', 'all_time']
