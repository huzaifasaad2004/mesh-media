'use client'

import { useState } from 'react'
import { Pencil, Loader2, Check, X } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

type Payment = { id: string; amount: number; payment_date: string; notes: string | null }

const inputClass = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'

export default function InvoicePaymentsModal({
  invoiceId, total, amountPaid, payments, canRecordNew, onChanged,
}: {
  invoiceId: string
  total: number
  amountPaid: number
  payments: Payment[]
  canRecordNew: boolean
  onChanged: () => void
}) {
  const toast = useToast()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [saving, setSaving] = useState(false)

  const remaining = Math.max(0, total - amountPaid)
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0])
  const [newAmount, setNewAmount] = useState('')
  const [recording, setRecording] = useState(false)

  const sorted = [...payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  const startEdit = (p: Payment) => {
    setEditingId(p.id)
    setEditDate(p.payment_date)
    setEditAmount(String(p.amount))
  }

  const saveEdit = async (id: string) => {
    setSaving(true)
    const res = await fetch(`/api/invoice-payments/${id}`, {
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
    const amount = newAmount || String(remaining)
    setRecording(true)
    const res = await fetch(`/api/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_date: newDate, amount }),
    })
    const d = await res.json()
    setRecording(false)
    if (res.ok) {
      toast.success(d.invoice?.status === 'paid' ? 'Payment recorded — invoice fully paid' : 'Partial payment recorded')
      setNewAmount(''); onChanged()
    } else toast.error(d.error ?? 'Failed to record payment')
  }

  return (
    <div className="space-y-5">
      <div className="bg-gray-50 rounded-lg p-3 flex items-center justify-between text-sm">
        <span className="text-gray-500">Paid <strong className="text-gray-900">{formatCurrency(amountPaid)}</strong> of {formatCurrency(total)}</span>
        <span className={remaining > 0 ? 'font-semibold text-orange-600' : 'font-semibold text-green-600'}>
          {remaining > 0 ? `${formatCurrency(remaining)} remaining` : 'Fully paid'}
        </span>
      </div>

      {canRecordNew && remaining > 0 && (
        <div className="border border-gray-200 rounded-lg p-4">
          <p className="text-sm font-semibold text-gray-900 mb-3">Record a payment</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={labelClass}>Payment Date</label>
              <input type="date" className={`${inputClass} w-full`} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Amount</label>
              <input type="number" className={`${inputClass} w-full`} placeholder={String(remaining)} value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
            </div>
          </div>
          <button onClick={recordPayment} disabled={recording} className="btn-primary btn-sm">
            {recording ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Record Payment
          </button>
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
                      {p.notes && <p className="text-xs text-gray-400">{p.notes}</p>}
                    </div>
                    <span className="text-sm font-semibold">{formatCurrency(p.amount)}</span>
                    {canRecordNew && (
                      <button onClick={() => startEdit(p)} className="btn-ghost btn-sm" title="Edit date/amount">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
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
