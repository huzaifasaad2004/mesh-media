'use client'

import { useRef, useState } from 'react'
import { Receipt, Sparkles, Loader2, Camera, CheckCircle, X } from 'lucide-react'
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

const fileToBase64 = (file: File): Promise<{ data: string; mime: string; dataUrl: string }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve({ data: result.split(',')[1], mime: file.type, dataUrl: result })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export default function QuickExpense() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [image, setImage] = useState<{ data: string; mime: string; dataUrl: string; name: string } | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [done, setDone] = useState(false)
  const [form, setForm] = useState({ description: '', amount: '', category: 'other', date: new Date().toISOString().split('T')[0] })
  const fileInput = useRef<HTMLInputElement>(null)

  const reset = () => {
    setText(''); setImage(null); setError(''); setInfo(''); setDone(false)
    setForm({ description: '', amount: '', category: 'other', date: new Date().toISOString().split('T')[0] })
  }

  const runExtract = async (payload: any) => {
    setExtracting(true); setError(''); setInfo('')
    try {
      const res = await fetch('/api/ai/extract-expense', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) {
        if ((d.error || '').includes('quota') || (d.error || '').includes('429') || (d.error || '').toLowerCase().includes('exhausted')) {
          throw new Error('AI is rate-limited right now (free tier). Fill the fields in manually, or try again in a minute.')
        }
        throw new Error(d.error ?? 'Could not read that')
      }
      setForm(f => ({
        description: d.description || f.description || text,
        amount: d.amount ? String(d.amount) : f.amount,
        category: d.category || f.category,
        date: d.date || f.date,
      }))
      if (d.confidence === 'low') setInfo('Read it — but double-check the amount, I wasn\'t fully sure.')
      else setInfo('Filled in from your receipt. Review and save.')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setExtracting(false)
    }
  }

  const onFile = async (file: File | null) => {
    if (!file) return
    const b = await fileToBase64(file)
    setImage({ ...b, name: file.name })
    // Auto-extract as soon as a receipt is attached
    runExtract({ text, image_base64: b.data, mime_type: b.mime })
  }

  const extractFromText = () => {
    if (!text.trim() && !image) return
    runExtract(image ? { text, image_base64: image.data, mime_type: image.mime } : { text })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      let receipt_url: string | null = null
      if (image) {
        const up = await fetch('/api/expenses/receipt', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: image.data, mime_type: image.mime }),
        })
        const ud = await up.json()
        if (up.ok) receipt_url = ud.url
        // If upload fails we still save the expense — just without the attachment
      }
      const res = await fetch('/api/expenses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) || 0, receipt_url }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Save failed')
      setDone(true)
      setTimeout(() => { setOpen(false); reset() }, 1200)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
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
            <p className="text-sm font-medium">Expense saved{image ? ' with receipt attached' : ''}</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Describe it, or attach a receipt</label>
              <textarea className={inputClass} rows={2} value={text} onChange={e => setText(e.target.value)}
                placeholder='e.g. "Paid 500 AED for Facebook ads today" — or attach a photo and AI fills it in' />
            </div>

            {/* Receipt attach + preview */}
            <div className="flex items-center gap-3">
              <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => onFile(e.target.files?.[0] ?? null)} />
              {image ? (
                <div className="relative">
                  <img src={image.dataUrl} alt="receipt" className="w-16 h-16 object-cover rounded-lg border border-sand-300" />
                  <button type="button" onClick={() => setImage(null)}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-white border border-sand-300 rounded-full flex items-center justify-center text-taupe-600 hover:text-red-500">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => fileInput.current?.click()} className="btn-ghost btn-sm">
                  <Camera className="w-3.5 h-3.5" /> Attach receipt photo
                </button>
              )}
              <button type="button" onClick={extractFromText} disabled={extracting || (!text.trim() && !image)} className="btn-secondary btn-sm ml-auto">
                {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {extracting ? 'Reading…' : 'Extract with AI'}
              </button>
            </div>

            {info && <p className="text-xs" style={{ color: 'var(--success)' }}>{info}</p>}

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
