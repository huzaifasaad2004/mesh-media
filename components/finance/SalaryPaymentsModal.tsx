'use client'

import { useState } from 'react'
import { Eye, Pencil, Loader2, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

type Payment = { id: string; amount: number; payment_date: string; period: string }

const inputClass = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

export default function SalaryPaymentsModal({
  salaryId, currency, salaryAmount, payments, canRecordNew, onChanged,
}: {
  salaryId: string
  currency: string
  salaryAmount: number
  payments: Payment[]
  canRecordNew: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newAmount, setNewAmount] = useState('')
  const [recording, setRecording] = useState(false)

  const sorted = [...payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  const newPeriod = newDate.slice(0, 7)
  const paidThisPeriod = payments.filter(p => p.period === newPeriod).reduce((sum, p) => sum + Number(p.amount), 0)
  const remainingThisPeriod = Math.max(0, salaryAmount - paidThisPeriod)
  const isPartialSoFar = paidThisPeriod > 0 && paidThisPeriod < salaryAmount

  const startEdit = (p: Payment) => {
    setEditingId(p.id)
    setEditDate(p.payment_date)
    setEditAmount(String(p.amount))
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    const res = await fetch(`/api/salary-payments/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_date: editDate, amount: editAmount }),
    })
    const d = await res.json()
    setSaving(false)
    if (res.ok) { toast.success('Payment updated'); setEditingId(null); onChanged() }
    else toast.error(d.error ?? 'Failed to update payment')
  }

  const recordPayment = async () => {
    setRecording(true)
    const amount = newAmount || (isPartialSoFar ? String(remainingThisPeriod) : undefined)
    const res = await fetch(`/api/salaries/${salaryId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_date: newDate, amount }),
    })
    const d = await res.json()
    setRecording(false)
    if (res.ok) { toast.success(d.emailed ? 'Payment recorded and payslip emailed' : 'Payment recorded'); setNewAmount(''); onChanged() }
    else toast.error(d.error ?? 'Failed to record payment')
  }

  return (
    <div className="space-y-5">
      {canRecordNew && (
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-900 mb-1">Record a payment</p>
          <p className="text-xs text-gray-500 mb-3">
            {paidThisPeriod > 0
              ? `${formatCurrency(paidThisPeriod, currency)} of ${formatCurrency(salaryAmount, currency)} paid for ${newPeriod} · ${formatCurrency(remainingThisPeriod, currency)} remaining`
              : `Full period amount: ${formatCurrency(salaryAmount, currency)} — enter a smaller amount for a partial/advance payment`}
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass}>Payment Date</label>
              <input type="date" className={`${inputClass} w-full`} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Amount {isPartialSoFar ? '(remaining balance)' : '(optional override)'}</label>
              <input type="number" className={`${inputClass} w-full`}
                placeholder={isPartialSoFar ? String(remainingThisPeriod) : 'Default salary amount'}
                value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
            </div>
          </div>
          <button onClick={recordPayment} disabled={recording || remainingThisPeriod === 0} className="btn-primary btn-sm">
            {recording ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Record {isPartialSoFar ? 'Remaining' : ''} Payment
          </button>
          {remainingThisPeriod === 0 && paidThisPeriod > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--success, #2E7D32)' }}>{newPeriod} is fully paid.</p>
          )}
        </div>
      )}

      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">Payment history</p>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2.5">
                {editingId === p.id ? (
                  <>
                    <input type="date" className={`${inputClass} flex-1`} value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                    <input type="number" className={`${inputClass} w-28`} value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
                    <button onClick={() => saveEdit(p.id)} disabled={saving} className="btn-ghost btn-sm text-green-600">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => setEditingId(null)} className="btn-ghost btn-sm text-gray-400"><X className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{formatDate(p.payment_date)}</p>
                      <p className="text-xs text-gray-400">{p.period}</p>
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(p.amount, currency)}</span>
                    <a href={`/payslip/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" title="View payslip">
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                    <button onClick={() => startEdit(p)} className="btn-ghost btn-sm" title="Edit date/amount">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
