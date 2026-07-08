'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, DollarSign, Loader2, Eye, Play } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import SalaryForm from '@/components/forms/SalaryForm'
import SalaryPaymentsModal from '@/components/finance/SalaryPaymentsModal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<any[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [payingSalaryId, setPayingSalaryId] = useState<string | null>(null)
  const [runningPayroll, setRunningPayroll] = useState(false)
  const toast = useToast()

  const load = useCallback(async () => {
    const [sRes, meRes] = await Promise.all([fetch('/api/salaries'), fetch('/api/profiles/me')])
    const s = await sRes.json()
    setSalaries(Array.isArray(s) ? s : [])
    try {
      const me = await meRes.json()
      setCanManage((me?.permissions ?? []).includes('payroll.write'))
    } catch { /* stays false */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const monthlyTotalsByCurrency = salaries
    .filter(s => !s.effective_to)
    .reduce((totals: Record<string, number>, s) => {
      const currency = s.currency ?? 'AED'
      totals[currency] = (totals[currency] ?? 0) + Number(s.amount)
      return totals
    }, {})

  const runPayroll = async () => {
    if (!confirm("Generate this month's payroll for every active monthly salary that hasn't been paid yet?")) return
    setRunningPayroll(true)
    const res = await fetch('/api/salaries/run-recurring', { method: 'POST' })
    const d = await res.json()
    setRunningPayroll(false)
    if (res.ok) { toast.success(`Generated ${d.generated.length} payslip(s)${d.skipped.length ? `, ${d.skipped.length} already paid` : ''}`); load() }
    else toast.error(d.error ?? 'Failed')
  }

  const payingSalary = salaries.find(s => s.id === payingSalaryId)

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/finance" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Salaries</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {Object.keys(monthlyTotalsByCurrency).length > 0
                ? Object.entries(monthlyTotalsByCurrency).map(([currency, total]) => formatCurrency(total, currency)).join(' + ') + '/month total payroll'
                : 'No active payroll'}
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button onClick={runPayroll} disabled={runningPayroll} className="btn-secondary">
              {runningPayroll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Run This Month&apos;s Payroll
            </button>
            <button onClick={() => setShowModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Set Salary
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Team Member</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Salary</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Pay Period</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Payments</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Status</th>
                {canManage && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {salaries.length > 0 ? salaries.map((sal) => {
                const payments = (sal.payments ?? []).sort((a: any, b: any) => b.payment_date.localeCompare(a.payment_date))
                const lastPayment = payments[0]
                const thisMonth = new Date().toISOString().slice(0, 7)
                const paidThisMonth = payments.some((p: any) => p.period === thisMonth)
                return (
                  <tr key={sal.id} className="table-row">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold">
                          {(sal.profile?.full_name ?? 'U')[0]}
                        </div>
                        <span className="font-medium text-gray-900">{sal.profile?.full_name ?? sal.profile?.email ?? '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold">{formatCurrency(sal.amount, sal.currency)}</td>
                    <td className="px-5 py-3 text-gray-500 capitalize">{sal.pay_period}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {payments.length > 0 ? (
                        <>
                          {payments.length} paid · last {formatDate(lastPayment.payment_date)}
                          {lastPayment.id && (
                            <a href={`/payslip/${lastPayment.id}`} target="_blank" rel="noopener noreferrer" className="ml-1.5 text-brand-600 hover:underline inline-flex items-center gap-0.5">
                              <Eye className="w-3 h-3" />
                            </a>
                          )}
                        </>
                      ) : 'No payments yet'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`badge ${sal.effective_to ? 'bg-gray-100 text-gray-500' : paidThisMonth ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {sal.effective_to ? 'Ended' : paidThisMonth ? 'Paid this month' : 'Active'}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-5 py-3">
                        {!sal.effective_to && (
                          <button onClick={() => setPayingSalaryId(sal.id)}
                            className="btn-secondary btn-sm ml-auto flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> Payments
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={canManage ? 6 : 5} className="px-5 py-16 text-center text-gray-400 text-sm">
                    No salaries set up yet{canManage ? ' — click "Set Salary" to add one' : ''}
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Set Salary">
        <SalaryForm onSuccess={() => { setShowModal(false); load() }} />
      </Modal>

      <Modal isOpen={!!payingSalaryId} onClose={() => setPayingSalaryId(null)} title={payingSalary ? `Payments · ${payingSalary.profile?.full_name ?? payingSalary.profile?.email ?? ''}` : 'Payments'}>
        {payingSalary && (
          <SalaryPaymentsModal
            salaryId={payingSalary.id}
            currency={payingSalary.currency}
            salaryAmount={Number(payingSalary.amount)}
            payments={payingSalary.payments ?? []}
            canRecordNew={!payingSalary.effective_to}
            onChanged={load}
          />
        )}
      </Modal>
    </div>
  )
}
