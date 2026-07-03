'use client'

import { useRef, useState } from 'react'
import { Receipt, Sparkles, Loader2, Camera, CheckCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'

const inputClass = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose focus:border-transparent'
const labelClass = 'block text-sm font-medium text-umber-700 mb-1'

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'office', label: 'Office & Rent' },
  { value: 'freelancer', label: 'Salaries & Freelancers' },
  { value: 'software', label: 'IT & Software' },
  { value: 'ads', label: 'Advertising & Marketing' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
]

const fileToBase64 = (file: File): Promise<{ data: string; mime: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve({ data: result.split(',')[1], mime: file.type })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function QuickExpense() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [image, setImage] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', category: 'other', date: new Date().toISOString().split('T')[0] })
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setText(''); setImage(null); setError(''); setDone(false)
    setForm({ description: '', amount: '', category: 'other', date: new Date().toISOString().split('T')[0] })
  }

  const extract = async () => {
    if (!text.trim() && !image) return
    setExtracting(true); setError('')
    try {
      let payload: any = { text }
      if (image) {
        const { data, mime } = await fileToBase64(image)
        payload = { text, image_base64: data, mime_type: mime }
      }
      const res = await fetch('/api/ai/extract-expense', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Could not read that')
      setForm({
        description: d.description || text,
        amount: d.amount ? String(d.amount) : '',
        category: d.category || 'other',
        date: d.date || new Date().toISOString().split('T')[0],
      })
      if (d.confidence === 'low') setError('Double-check the amount — I wasn\'t fully sure.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/expenses', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, amount: parseFloat(form.amount) || 0 }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Save failed'); return }
    setDone(true)
    setTimeout(() => { setOpen(false); reset() }, 1200)
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Receipt className="w-4 h-4" /> Record Expense
      </button>

      <Modal isOpen={open} onClose={() => { setOpen(false); reset() }} title="Record Expense">
        {done ? (
          <div className="text-center py-8">
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--success)' }} />
            <p className="text-sm font-medium">Expense saved</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Describe it, or attach a receipt</label>
              <textarea className={inputClass} rows={2} value={text} onChange={e => setText(e.target.value)}
                placeholder='e.g. "Paid 500 AED for Facebook ads today" or upload a photo below' />
            </div>
            <div className="flex items-center gap-2">
              <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => setImage(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost btn-sm">
                <Camera className="w-3.5 h-3.5" /> {image ? image.name : 'Attach receipt photo'}
              </button>
              <button type="button" onClick={extract} disabled={extracting || (!text.trim() && !image)} className="btn-secondary btn-sm ml-auto">
                {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Extract with AI
              </button>
            </div>

            <div className="border-t border-paper-200 pt-4">
              <form onSubmit={save} className="space-y-3">
                <div>
                  <label className={labelClass}>Description</label>
                  <input className={inputClass} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Amount (AED)</label>
                    <input className={inputClass} type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                  </div>
                  <div>
                    <label className={labelClass}>Category</label>
                    <select className={inputClass} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Date</label>
                  <input className={inputClass} type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
                <button type="submit" className="btn-primary w-full justify-center" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Expense'}
                </button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
