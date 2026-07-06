'use client'

import { useEffect, useState, useCallback } from 'react'
import { Globe, Loader2, RotateCw } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'
import ViewAsButton from '@/components/ViewAsButton'
import { formatRelativeDate } from '@/lib/utils'

type PortalUser = { id: string; full_name: string | null; email: string | null; last_sign_in_at: string | null }

export default function PortalAccessCard({ clientId, clientEmail }: { clientId: string; clientEmail: string | null }) {
  const [loading, setLoading] = useState(true)
  const [portalEnabled, setPortalEnabled] = useState(true)
  const [users, setUsers] = useState<PortalUser[]>([])
  const [toggling, setToggling] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [resending, setResending] = useState<string | null>(null)
  const toast = useToast()

  const load = useCallback(async () => {
    const res = await fetch(`/api/clients/${clientId}/portal-access`)
    const data = await res.json()
    if (res.ok) {
      setPortalEnabled(data.portal_enabled)
      setUsers(data.users ?? [])
    }
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  const togglePortal = async () => {
    const next = !portalEnabled
    setToggling(true)
    const res = await fetch(`/api/clients/${clientId}/portal-access`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portal_enabled: next }),
    })
    const d = await res.json()
    setToggling(false)
    if (res.ok) {
      setPortalEnabled(next)
      toast.success(next ? 'Portal access enabled' : 'Portal access paused')
    } else {
      toast.error(d.error ?? 'Failed to update portal access')
    }
  }

  const invite = async (email?: string) => {
    const target = email ?? clientEmail
    if (!target) return
    if (email) setResending(email); else setInviting(true)
    const res = await fetch(`/api/clients/${clientId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: target }),
    })
    const d = await res.json()
    setResending(null); setInviting(false)
    if (res.ok) { toast.success(`Invited ${d.to}`); load() }
    else toast.error(d.error ?? 'Invite failed')
  }

  if (loading) return <div className="card p-5 h-32 animate-pulse bg-paper-100" />

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2"><Globe className="w-4 h-4 text-gray-400" /> Client Portal</h3>
        <button
          onClick={togglePortal}
          disabled={toggling}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${portalEnabled ? 'bg-brand-600' : 'bg-gray-200'}`}
          title={portalEnabled ? 'Portal enabled — click to pause' : 'Portal paused — click to enable'}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${portalEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {!portalEnabled && (
        <p className="text-xs mb-3 px-2.5 py-1.5 rounded" style={{ color: 'var(--danger)', background: 'var(--danger-bg)' }}>
          Portal access is paused — invited users can't sign in until you re-enable it.
        </p>
      )}

      {users.length > 0 ? (
        <div className="space-y-2.5">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.full_name ?? u.email ?? 'Unnamed'}</p>
                <p className="text-xs text-gray-400 truncate">
                  {u.email} · {u.last_sign_in_at ? `Last login ${formatRelativeDate(u.last_sign_in_at)}` : 'Never signed in'}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <ViewAsButton userId={u.id} name={u.full_name ?? u.email ?? 'this client'} />
                <button
                  onClick={() => u.email && invite(u.email)}
                  disabled={resending === u.email}
                  className="btn-ghost btn-sm"
                  title="Resend invite"
                >
                  {resending === u.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCw className="w-3 h-3" />} Resend
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-3">No portal users invited yet.</p>
      )}

      {users.length === 0 && (
        <button onClick={() => invite()} disabled={inviting || !clientEmail} className="btn-primary btn-sm mt-1" title={!clientEmail ? 'Add a client email first' : undefined}>
          {inviting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />} Invite to portal
        </button>
      )}
    </div>
  )
}
