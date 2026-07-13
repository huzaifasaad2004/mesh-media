'use client'

import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate } from '@/lib/utils'

type Payment = { id: string; amount: number; currency: string; payment_date: string; description: string | null; project?: { name: string } | null }

const inputClass = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const labelClass = 'block text-xs font-medium text-gray-500 mb-1'
const CURRENCIES = ['AED', 'PKR', 'USD', 'GBP', 'INR']

export default function ContractorPaymentsModal({
  contractorId, payments, projects, onChanged,
}: {
  contractorId: string
  payments: Payment[]
  projects: { id: string; name: string }[]
  onChanged: () => void
}) {
  const toast = useToast()
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('AED')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('')
  const [recording, setRecording] = useState(false)

  const sorted = [...payments].sort((a, b) => b.payment_date.localeCompare(a.payment_date))

  const recordPayment = async () => {
    if (!amount) { toast.error('Amount is required'); return }
    setRecording(true)
    const res = await fetch(`/api/contractors/${contractorId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, currency, payment_date: date, description, project_id: projectId || undefined }),
    })
    const d = await res.json()
    setRecording(false)
    if (res.ok) {
      toast.success(d.emailed ? 'Payment recorded and receipt emailed' : 'Payment recorded')
      setAmount(''); setDescription(''); setProjectId('')
      onChanged()
    } else toast.error(d.error ?? 'Failed to record payment')
  }

  return (
    <div className="space-y-5">
      <div className="border border-gray-200 rounded-lg p-4">
        <p className="text-sm font-semibold text-gray-900 mb-3">Record a payment</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={labelClass}>Amount *</label>
            <input type="number" min="0" step="0.01" className={`${inputClass} w-full`} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Currency</label>
            <select className={`${inputClass} w-full`} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" className={`${inputClass} w-full`} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {projects.length > 0 && (
            <div>
              <label className={labelClass}>Project (optional)</label>
              <select className={`${inputClass} w-full`} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">—</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="mb-3">
          <label className={labelClass}>Description</label>
          <input className={`${inputClass} w-full`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this payment was for" />
        </div>
        <button onClick={recordPayment} disabled={recording} className="btn-primary btn-sm">
          {recording ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Record Payment
        </button>
      </div>

      <div>
        <p className="text-sm font-semibold text-gray-900 mb-3">Payment history</p>
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400">No payments recorded yet</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((p) => (
              <div key={p.id} className="flex items-center gap-2 border border-gray-100 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{formatDate(p.payment_date)}</p>
                  <p className="text-xs text-gray-400 truncate">{p.description ?? p.project?.name ?? '—'}</p>
                </div>
                <span className="text-sm font-semibold">{formatCurrency(p.amount, p.currency)}</span>
                <a href={`/receipt/${p.id}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm" title="View receipt">
                  <Eye className="w-3.5 h-3.5" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
