'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type Forecast = {
  retainerIncome: number
  outstanding: number
  monthlyPayroll: number
  payrollByCurrency: Record<string, number>
  recurringExpenseTotal: number
  monthlyBurn: number
  steadyStateNet: number
  months: { label: string; net: number }[]
}

export default function CashFlowForecast() {
  const [data, setData] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/finance/cashflow').then((r) => r.json()).then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="card h-40 animate-pulse bg-gray-100 mb-8" />
  if (!data) return null

  const maxAbs = Math.max(1, ...data.months.map((m) => Math.abs(m.net)))
  const nonAedPayroll = Object.entries(data.payrollByCurrency ?? {}).filter(([currency]) => currency !== 'AED')

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h3>Cash-Flow Forecast</h3>
        <span className="text-xs text-gray-400">AED forecast · retainers + outstanding − AED costs</span>
      </div>

      {nonAedPayroll.length > 0 && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Separate monthly payroll commitments: {nonAedPayroll.map(([currency, amount]) => formatCurrency(amount, currency)).join(' + ')}.
          They are shown separately and are not mixed into the AED forecast without an approved exchange rate.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5 text-sm">
        <div>
          <p className="text-gray-400 text-xs">Recurring income</p>
          <p className="font-semibold text-green-700">{formatCurrency(data.retainerIncome)}/mo</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Outstanding (one-time)</p>
          <p className="font-semibold text-orange-600">{formatCurrency(data.outstanding)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Payroll + recurring costs</p>
          <p className="font-semibold text-red-600">{formatCurrency(data.monthlyBurn)}/mo</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs">Steady-state net</p>
          <p className={`font-semibold flex items-center gap-1 ${data.steadyStateNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {data.steadyStateNet >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {formatCurrency(data.steadyStateNet)}/mo
          </p>
        </div>
      </div>

      <div className="flex items-end gap-4 h-24">
        {data.months.map((m) => {
          const heightPct = Math.max(6, (Math.abs(m.net) / maxAbs) * 100)
          return (
            <div key={m.label} className="flex-1 flex flex-col items-center justify-end h-full">
              <span className={`text-xs font-medium mb-1 ${m.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>{formatCurrency(m.net)}</span>
              <div className="w-full rounded-t" style={{ height: `${heightPct}%`, background: m.net >= 0 ? 'var(--success, #4F7A4A)' : 'var(--danger, #B23A2E)' }} />
              <span className="text-[11px] text-gray-400 mt-1">{m.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
