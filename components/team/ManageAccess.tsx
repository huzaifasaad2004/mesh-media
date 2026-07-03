'use client'

import { useState } from 'react'
import { ShieldCheck, Loader2, RotateCcw } from 'lucide-react'
import Modal from '@/components/ui/Modal'

interface PermRow { key: string; description: string | null; role_default: boolean; override: boolean | null; effective: boolean }

export default function ManageAccess({ userId, name }: { userId: string; name: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<PermRow[]>([])
  const [pending, setPending] = useState<Record<string, boolean | null>>({})
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true); setError('')
    const res = await fetch(`/api/team/${userId}/permissions`)
    const d = await res.json()
    setLoading(false)
    if (!res.ok) { setError(d.error ?? 'Failed to load'); return }
    setRows(d.permissions)
    setPending({})
  }

  const openModal = () => { setOpen(true); load() }

  const toggle = (key: string, current: boolean) => {
    setPending(p => ({ ...p, [key]: !current }))
  }

  const resetOne = (key: string) => {
    setPending(p => ({ ...p, [key]: null }))
  }

  const effectiveFor = (row: PermRow): boolean => {
    if (Object.prototype.hasOwnProperty.call(pending, row.key)) {
      const v = pending[row.key]
      return v === null ? row.role_default : v
    }
    return row.effective
  }
  const isOverridden = (row: PermRow) => {
    const v = Object.prototype.hasOwnProperty.call(pending, row.key) ? pending[row.key] : row.override
    return v !== null && v !== row.role_default
  }

  const save = async () => {
    if (Object.keys(pending).length === 0) { setOpen(false); return }
    setSaving(true); setError('')
    // Convert pending effective-values back into overrides: null clears, else explicit grant/revoke
    const overrides: Record<string, boolean | null> = {}
    for (const row of rows) {
      if (!Object.prototype.hasOwnProperty.call(pending, row.key)) continue
      const val = pending[row.key]
      overrides[row.key] = val === row.role_default ? null : val
    }
    const res = await fetch(`/api/team/${userId}/permissions`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overrides }),
    })
    const d = await res.json()
    setSaving(false)
    if (!res.ok) { setError(d.error ?? 'Save failed'); return }
    setOpen(false)
  }

  return (
    <>
      <button onClick={openModal} className="btn-ghost btn-sm flex-1 justify-center">
        <ShieldCheck className="w-3 h-3" /> Manage Access
      </button>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={`Access — ${name}`}>
        {loading ? (
          <div className="py-10 text-center text-sm text-taupe-500">Loading…</div>
        ) : (
          <div className="space-y-1">
            <p className="text-xs text-taupe-600 mb-3">
              Toggle exact permissions for this person instead of relying only on their role&apos;s defaults.
              A pencil icon means it&apos;s been customized away from their role.
            </p>
            {rows.map(row => {
              const eff = effectiveFor(row)
              const overridden = isOverridden(row)
              return (
                <div key={row.key} className="flex items-center justify-between py-2 border-b border-paper-200 last:border-0">
                  <div className="min-w-0 pr-3">
                    <p className="text-sm text-ink flex items-center gap-1.5">
                      {row.key}
                      {overridden && <span title="Customized for this person"><RotateCcw className="w-3 h-3 text-brand-500" /></span>}
                    </p>
                    {row.description && <p className="text-xs text-taupe-500">{row.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {overridden && (
                      <button onClick={() => resetOne(row.key)} className="text-[11px] text-taupe-500 hover:text-brand-600 underline">
                        reset
                      </button>
                    )}
                    <button
                      role="switch"
                      aria-checked={eff}
                      onClick={() => toggle(row.key, eff)}
                      className="w-9 h-5 rounded-full transition-colors relative flex-shrink-0"
                      style={{ background: eff ? 'var(--maroon)' : '#D8D2C6' }}
                    >
                      <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: eff ? 'translateX(18px)' : 'translateX(2px)' }} />
                    </button>
                  </div>
                </div>
              )
            })}

            {error && <p className="text-sm pt-2" style={{ color: 'var(--danger)' }}>{error}</p>}

            <button onClick={save} disabled={saving} className="btn-primary w-full justify-center mt-4">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Save access
            </button>
          </div>
        )}
      </Modal>
    </>
  )
}
