'use client'

import { useEffect, useState } from 'react'
import { Wallet, Eye } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function MyPayPage() {
  const [data, setData] = useState<{ salary: any; payments: any[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/my-pay').then(r => r.json()).then(d => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const salary = data?.salary
  const payments = data?.payments ?? []
  const currency = salary?.currency ?? 'AED'
  const paidYTD = payments
    .filter(p => new Date(p.payment_date).getFullYear() === new Date().getFullYear())
    .reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>My Pay</h1>
          <p className="text-taupe-600 text-sm mt-0.5">Your salary and payment history</p>
        </div>
      </div>

      {loading ? (
        <div className="card h-40 animate-pulse bg-paper-100" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="stat-card">
              <p className="text-xs text-taupe-600">Current salary</p>
              <p className="stat-number text-ink">{salary ? formatCurrency(salary.amount, salary.currency) : '—'}</p>
              <p className="text-xs text-taupe-500">{salary ? `per ${salary.pay_period.replace('ly', '')}` : 'Not set'}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-taupe-600">Paid this year</p>
              <p className="stat-number text-ink">{formatCurrency(paidYTD, currency)}</p>
              <p className="text-xs text-taupe-500">{payments.length} payment{payments.length === 1 ? '' : 's'}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-taupe-600">Effective since</p>
              <p className="stat-number text-ink" style={{ fontSize: 18 }}>{salary?.effective_from ? formatDate(salary.effective_from) : '—'}</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-paper-200">
              <Wallet className="w-4 h-4 text-taupe-500" />
              <h3>Payment history</h3>
            </div>
            {payments.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-paper-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Date</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Amount</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-taupe-600">Notes</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-paper-200">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-paper-50">
                      <td className="px-5 py-3 text-umber-700">{formatDate(p.payment_date)}</td>
                      <td className="px-5 py-3 font-semibold">{formatCurrency(p.amount, currency)}</td>
                      <td className="px-5 py-3 text-taupe-600">{p.notes ?? '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <a href={`/payslip/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline inline-flex items-center gap-1 text-xs">
                          <Eye className="w-3 h-3" /> View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-5 py-12 text-center text-taupe-500 text-sm">No payments recorded yet.</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
