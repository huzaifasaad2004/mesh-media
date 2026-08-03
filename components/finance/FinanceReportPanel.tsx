'use client'

import { useEffect, useState, useCallback } from 'react'
import { DollarSign, AlertCircle, TrendingDown, TrendingUp, Trophy, WalletCards } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ALL_PERIODS, PERIOD_LABELS, type ReportPeriod } from '@/lib/reportPeriods'

interface Report {
  revenue: number
  expenses: number
  outstanding: number
  monthlyPayrollByCurrency: Record<string, number>
  payrollPaidByCurrency: Record<string, number>
  netProfit: number
  invoiceCount: number
  topClients: { name: string; total: number }[]
  trend: { month: string; total: number }[]
}

const monthLabel = (ym: string) => new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'short' })

export default function FinanceReportPanel() {
  const [period, setPeriod] = useState<ReportPeriod>('this_month')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (p: ReportPeriod) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/finance/reports?period=${p}`)
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Could not load the finance report')
      setReport(d)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load the finance report')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(period) }, [period, load])

  const maxTrend = Math.max(1, ...(report?.trend.map(t => t.total) ?? [1]))
  const payrollPaid = Object.entries(report?.payrollPaidByCurrency ?? {})

  return (
    <div className="mb-8">
      {/* Period selector */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {ALL_PERIODS.map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              period === p ? 'bg-brand-600 text-paper-100' : 'bg-paper-100 text-umber-700 hover:bg-paper-200'
            }`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        {[
          { label: `Revenue · ${report ? PERIOD_LABELS[period] : ''}`, value: report?.revenue ?? 0, icon: DollarSign, color: 'text-green-700', bg: 'bg-green-50' },
          { label: 'Outstanding (all time)', value: report?.outstanding ?? 0, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: `Expenses · ${report ? PERIOD_LABELS[period] : ''}`, value: report?.expenses ?? 0, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Net cash result (AED receipts − AED costs paid)', value: report?.netProfit ?? 0, icon: TrendingUp, color: (report?.netProfit ?? 0) >= 0 ? 'text-green-700' : 'text-red-600', bg: (report?.netProfit ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <p className={`stat-number ${color}`}>{loading ? '—' : formatCurrency(value)}</p>
            <p className="text-xs text-taupe-600">{label}</p>
          </div>
        ))}
      </div>

      {payrollPaid.length > 0 && (
        <div className="card px-4 py-3 mb-5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
          <WalletCards className="w-4 h-4 text-brand-600 flex-shrink-0" />
          <p className="text-sm text-umber-700">
            Payroll actually paid · {PERIOD_LABELS[period]}: <strong>{payrollPaid.map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ')}</strong>
          </p>
          {payrollPaid.some(([currency]) => currency !== 'AED') && (
            <span className="text-xs text-taupe-500 sm:ml-auto">Non-AED payroll is disclosed separately, not silently converted.</span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue trend */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-ink mb-3">Cash received · last 12 months</p>
          {report && report.trend.length > 0 ? (
            <div className="flex items-end gap-1.5" style={{ height: 90 }}>
              {report.trend.map(t => (
                <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-brand-600 rounded-t transition-all" style={{ height: `${Math.max(4, (t.total / maxTrend) * 70)}px` }} title={formatCurrency(t.total)} />
                  <span className="text-[10px] text-taupe-500">{monthLabel(t.month)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-taupe-500 py-6 text-center">No payments received yet</p>
          )}
        </div>

        {/* Top clients */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-ink mb-3 flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-brand-500" /> Highest-paying clients · {report ? PERIOD_LABELS[period] : ''}</p>
          {report && report.topClients.length > 0 ? (
            <div className="space-y-2.5">
              {report.topClients.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-sm">
                  <span className="text-umber-700 truncate">{i + 1}. {c.name}</span>
                  <span className="font-semibold text-ink flex-shrink-0">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-taupe-500 py-6 text-center">No client payments received in this period</p>
          )}
        </div>
      </div>
    </div>
  )
}
