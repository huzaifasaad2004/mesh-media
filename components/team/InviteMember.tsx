'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, Plus, CheckCircle } from 'lucide-react'
import Modal from '@/components/ui/Modal'

const ROLES = [
  { value: 'admin',   label: 'Admin — full access incl. finance & team' },
  { value: 'manager', label: 'Manager — clients, tasks & finance' },
  { value: 'member',  label: 'Member — clients & tasks, no finance' },
  { value: 'viewer',  label: 'Viewer — read-only' },
]

export default function InviteMember({ variant = 'button' }: { variant?: 'button' | 'card' }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, full_name: fullName, role }),
    })
    const d = await res.json()
    setLoading(false)
    if (!res.ok) { setError(d.error ?? 'Invite failed'); return }
    setDone(true)
    setTimeout(() => { setOpen(false); setDone(false); setEmail(''); setFullName(''); router.refresh() }, 1800)
  }

  return (
    <>
      {variant === 'button' ? (
        <button className="btn-primary" onClick={() => setOpen(true)}>
          <UserPlus className="w-4 h-4" /> Invite Member
        </button>
      ) : (
        <button onClick={() => setOpen(true)}
          className="card p-5 border-dashed border-2 border-sand-300 bg-paper-50 flex flex-col items-center justify-center text-center min-h-[180px] hover:border-brand-300 hover:bg-brand-50 transition-colors cursor-pointer w-full">
          <div className="w-10 h-10 bg-paper-200 rounded-full flex items-center justify-center mb-3">
            <Plus className="w-5 h-5 text-taupe-500" />
          </div>
          <p className="text-sm font-medium text-umber-700">Invite team member</p>
          <p className="text-xs text-taupe-500 mt-1">Send an email invite</p>
        </button>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="Invite team member">
        {done ? (
          <div className="text-center py-8">
            <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--success)' }} />
            <p className="text-sm font-medium">Invite sent to {email}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email *</label>
              <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required placeholder="teammate@meshmedia.com" />
            </div>
            <div>
              <label className="label">Full name</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Their name" />
            </div>
            <div>
              <label className="label">Role</label>
              <select className="input" value={role} onChange={e => setRole(e.target.value)}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={loading}>
              {loading ? 'Sending…' : 'Send invite'}
            </button>
          </form>
        )}
      </Modal>
    </>
  )
}
