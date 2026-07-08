'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Mail, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

const LABELS: Record<string, { title: string; helper: string }> = {
  task_assignment:   { title: 'Task assignments', helper: 'When a task is assigned or its status changes.' },
  approval_request:  { title: 'Approval requests', helper: 'Time-off, expense, and other requests needing your decision — and decisions on your own requests.' },
  content_review:    { title: 'Content approvals', helper: 'Content sent for your review, forwarded to a client, or decided.' },
  critical_alert:    { title: 'Critical alerts', helper: 'Invoices/quotations sent, documents signed, payslips, and other important events.' },
}

export default function NotificationPreferencesPage() {
  const [prefs, setPrefs] = useState<{ category: string; email_enabled: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    fetch('/api/notification-preferences').then(r => r.json()).then(d => { setPrefs(Array.isArray(d) ? d : []); setLoading(false) })
  }, [])

  const toggle = async (category: string, current: boolean) => {
    setSaving(category)
    setPrefs(p => p.map(x => x.category === category ? { ...x, email_enabled: !current } : x))
    const res = await fetch('/api/notification-preferences', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category, email_enabled: !current }),
    })
    if (!res.ok) { toast.error('Failed to save'); setPrefs(p => p.map(x => x.category === category ? { ...x, email_enabled: current } : x)) }
    setSaving(null)
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-taupe-500 hover:text-umber-700"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Notification Settings</h1>
            <p className="text-taupe-600 text-sm mt-0.5">In-app notifications always happen. Choose what also emails you.</p>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="px-5 py-16 text-center text-taupe-500 text-sm">Loading…</div>
        ) : (
          <div className="divide-y divide-paper-200">
            {prefs.map(p => (
              <div key={p.category} className="px-5 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-taupe-500" /> {LABELS[p.category]?.title ?? p.category}
                  </p>
                  <p className="text-xs text-taupe-500 mt-0.5">{LABELS[p.category]?.helper}</p>
                </div>
                <button
                  onClick={() => toggle(p.category, p.email_enabled)}
                  disabled={saving === p.category}
                  className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${p.email_enabled ? 'bg-brand-600' : 'bg-paper-300'}`}
                >
                  {saving === p.category ? (
                    <Loader2 className="w-3 h-3 animate-spin absolute top-1.5 left-1.5 text-white" />
                  ) : (
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${p.email_enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
