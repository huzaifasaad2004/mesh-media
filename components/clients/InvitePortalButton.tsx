'use client'

import { useState } from 'react'
import { Globe, Loader2, Check } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function InvitePortalButton({ clientId, disabled }: { clientId: string; disabled?: boolean }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle')
  const toast = useToast()

  const invite = async () => {
    if (!confirm('Send this client a portal invite email?')) return
    setState('loading')
    const res = await fetch(`/api/clients/${clientId}/invite`, { method: 'POST' })
    const d = await res.json()
    if (res.ok) {
      setState('done')
      toast.success(`Invited ${d.to}`)
    } else {
      setState('idle')
      toast.error(d.error ?? 'Invite failed')
    }
  }

  if (state === 'done') return <span className="btn-ghost btn-sm text-xs" style={{ color: 'var(--success)' }}><Check className="w-3 h-3" /> Invited</span>

  return (
    <button onClick={invite} disabled={disabled || state === 'loading'} className="btn-ghost btn-sm" title={disabled ? 'Add a client email first' : 'Invite to client portal'}>
      {state === 'loading' ? <Loader2 className="w-3 h-3 animate-spin" /> : <Globe className="w-3 h-3" />} Portal
    </button>
  )
}
