'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, DollarSign, Loader2, CheckCircle, Eye, Play } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import SalaryForm from '@/components/forms/SalaryForm'
import { formatCurrency, formatDate } from '@/lib/utils'

export default function SalariesPage() {
  const [salaries, setSalaries] = useState<any[]>([])
  const [canManage, setCanManage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [paying, setPaying] = useState<string | null>(null)
  const [runningPayroll, setRunningPayroll] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

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

  const monthlyTotal = salaries.filter(s => !s.effective_to).reduce((sum, s) => sum + Number(s.amount), 0)

  const recordPayment = async (salaryId: string) => {
    setPaying(salaryId); setMsg(null)
    const res = await fetch(`/api/salaries/${salaryId}/pay`, { method: 'POST' })
    const d = await res.json()
    setPaying(null)
    setMsg({ text: res.ok ? (d.emailed ? 'Payment recorded and payslip emailed' : 'Payment recorded (email not sent — check Resend setup)') : (d.error ?? 'Failed'), ok: res.ok })
    if (res.ok) load()
    setTimeout(() => setMsg(null), 5000)
  }

  const runPayroll = async () => {
    if (!confirm("Generate this month's payroll for every active monthly salary that hasn't been paid yet?")) return
    setRunningPayroll(true); setMsg(null)
    const res = await fetch('/api/salaries/run-recurring', { method: 'POST' })
    const d = await res.json()
    setRunningPayroll(false)
    setMsg({
      text: res.ok ? `Generated ${d.generated.length} payslip(s)${d.skipped.length ? `, ${d.skipped.length} already paid` : ''}` : (d.error ?? 'Failed'),
      ok: res.ok,
    })
    if (res.ok) load()
    setTimeout(() => setMsg(null), 6000)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/finance" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Salaries</h1>
            <p className="text-gray-500 text-sm mt-0.5">{formatCurrency(monthlyTotal)}/month total payroll (AED-denominated)</p>
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

      {msg && (
        <div className={`mb-4 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${msg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.ok && <CheckCircle className="w-4 h-4" />} {msg.text}
        </div>
      )}

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
                        {!sal.effective_to && !paidThisMonth && (
                          <button onClick={() => recordPayment(sal.id)} disabled={paying === sal.id}
                            className="btn-secondary btn-sm ml-auto flex items-center gap-1">
                            {paying === sal.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <DollarSign className="w-3 h-3" />} Pay Now
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
    </div>
  )
}
