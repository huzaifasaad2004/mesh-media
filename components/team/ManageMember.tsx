'use client'

import { useState } from 'react'
import { Loader2, Pencil, UserMinus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Modal from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'

const inputClass = 'w-full border border-sand-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose'
const labelClass = 'block text-sm font-medium text-umber-700 mb-1'

export default function ManageMember({ member }: { member: { id: string; full_name: string | null; email: string | null; role: string } }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ full_name: member.full_name ?? '', email: member.email ?? '', role: member.role })
  const router = useRouter()
  const toast = useToast()

  const save = async () => {
    setSaving(true); setError('')
    const response = await fetch(`/api/team/${member.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await response.json().catch(() => ({}))
    setSaving(false)
    if (!response.ok) { setError(data.error ?? 'Could not update the team member'); return }
    toast.success('Team member updated')
    setOpen(false)
    router.refresh()
  }

  const remove = async () => {
    if (!confirm(`Remove ${member.full_name ?? member.email} from the team? Their access will be blocked immediately, while tasks, payroll, and audit history stay intact.`)) return
    setRemoving(true); setError('')
    const response = await fetch(`/api/team/${member.id}`, { method: 'DELETE' })
    const data = await response.json().catch(() => ({}))
    setRemoving(false)
    if (!response.ok) { setError(data.error ?? 'Could not remove access'); return }
    toast.success('Team member removed; history preserved')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost btn-sm flex-1 justify-center"><Pencil className="w-3 h-3" /> Edit</button>
      <Modal isOpen={open} onClose={() => setOpen(false)} title={`Edit — ${member.full_name ?? member.email}`}>
        <div className="space-y-4">
          <div><label className={labelClass}>Name</label><input className={inputClass} value={form.full_name} onChange={event => setForm(current => ({ ...current, full_name: event.target.value }))} /></div>
          <div><label className={labelClass}>Login email</label><input type="email" className={inputClass} value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></div>
          <div><label className={labelClass}>Role</label><select className={inputClass} value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value }))}><option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Member</option><option value="viewer">Viewer</option></select></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={save} disabled={saving || removing} className="btn-primary w-full justify-center">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save changes</button>
          <div className="border-t border-sand-300 pt-4">
            <button onClick={remove} disabled={saving || removing} className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 flex items-center justify-center gap-2">
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserMinus className="w-4 h-4" />} Remove access and archive
            </button>
            <p className="text-xs text-taupe-500 mt-1.5">This removes login access without deleting financial or task history.</p>
          </div>
        </div>
      </Modal>
    </>
  )
}
