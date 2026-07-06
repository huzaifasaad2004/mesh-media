'use client'

import { useState } from 'react'
import { KeyRound, Loader2, Mail, Eye, EyeOff, Check } from 'lucide-react'
import Modal from '@/components/ui/Modal'

export default function ManagePassword({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState<'set' | 'reset' | null>(null)
  const [done, setDone] = useState('')
  const [error, setError] = useState('')

  const call = async (payload: Record<string, string>, which: 'set' | 'reset') => {
    setBusy(which); setError(''); setDone('')
    try {
      const res = await fetch(`/api/team/${userId}/password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Request failed')
      setDone(d.message ?? 'Done')
      setPassword('')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); setDone(''); setError('') }}
        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-umber-700 bg-paper-100 hover:bg-paper-200 border border-sand-300 rounded-lg px-3 py-2 transition-colors"
      >
        <KeyRound size={13} /> Password
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={`Password — ${name}`} size="md">
        <div className="space-y-5">
          <div>
            <p className="text-xs font-medium text-taupe-600 uppercase tracking-wide mb-2">Set a password directly</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="New password (min 8 characters)"
                  className="w-full border border-sand-300 rounded-lg px-3 py-2 text-sm pr-9 focus:outline-none focus:ring-2 focus:ring-rose"
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-taupe-500">
                  {show ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <button
                onClick={() => call({ action: 'set', password }, 'set')}
                disabled={busy !== null || password.length < 8}
                className="bg-maroon hover:bg-maroon-dark text-paper-100 text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-50 flex items-center gap-1.5"
              >
                {busy === 'set' ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} Set
              </button>
            </div>
            <p className="text-xs text-taupe-500 mt-1.5">Share it with them directly — they can change it later.</p>
          </div>

          <div className="border-t border-sand-300 pt-4">
            <p className="text-xs font-medium text-taupe-600 uppercase tracking-wide mb-2">Or let them choose</p>
            <button
              onClick={() => call({ action: 'reset' }, 'reset')}
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-2 border border-sand-300 bg-white hover:bg-paper-50 text-sm font-medium text-ink rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {busy === 'reset' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              Email them a password-reset link
            </button>
          </div>

          {done && (
            <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
              <Check size={14} /> {done}
            </p>
          )}
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>
      </Modal>
    </>
  )
}
