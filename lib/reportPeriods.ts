export type ReportPeriod = 'this_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'all_time'

export const PERIOD_LABELS: Record<ReportPeriod, string> = {
  this_week: 'This Week',
  this_month: 'This Month',
  last_month: 'Last Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
  all_time: 'All Time',
}

const BUSINESS_TIME_ZONE = 'Asia/Dubai'

const isoUtc = (d: Date) => {
  const year = d.getUTCFullYear()
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const businessDateParts = (now: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(part => part.type === type)?.value)
  return { year: value('year'), month: value('month') - 1, day: value('day') }
}

const dateAt = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day))

/** Inclusive [start, end] date range (YYYY-MM-DD) for a named period. end=null means open-ended (all_time only) — current-period ranges are capped at today so future-dated rows never leak in. */
export function resolvePeriod(period: ReportPeriod, now = new Date()): { start: string | null; end: string | null } {
  const { year: y, month: m, day: d } = businessDateParts(now)
  const todayDate = dateAt(y, m, d)
  const today = isoUtc(todayDate)

  switch (period) {
    case 'this_week': {
      const weekday = (todayDate.getUTCDay() + 6) % 7 // Monday = 0
      return { start: isoUtc(dateAt(y, m, d - weekday)), end: today }
    }
    case 'this_month':
      return { start: isoUtc(dateAt(y, m, 1)), end: today }
    case 'last_month':
      return { start: isoUtc(dateAt(y, m - 1, 1)), end: isoUtc(dateAt(y, m, 0)) }
    case 'this_quarter': {
      const qStartMonth = Math.floor(m / 3) * 3
      return { start: isoUtc(dateAt(y, qStartMonth, 1)), end: today }
    }
    case 'this_year':
      return { start: isoUtc(dateAt(y, 0, 1)), end: today }
    case 'all_time':
    default:
      return { start: null, end: null }
  }
}

export const ALL_PERIODS: ReportPeriod[] = ['this_week', 'this_month', 'last_month', 'this_quarter', 'this_year', 'all_time']
