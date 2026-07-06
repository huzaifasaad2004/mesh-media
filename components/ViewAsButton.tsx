'use client'

import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function ViewAsButton({ userId, name }: { userId: string; name: string }) {
  const [loading, setLoading] = useState(false)
  const toast = useToast()

  const start = async () => {
    if (!confirm(`View the app as ${name}? Your admin session will be restored when you click "Return to admin".`)) return
    setLoading(true)
    const res = await fetch('/api/admin/impersonate/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId }),
    })
    const d = await res.json()
    if (res.ok) {
      window.location.href = d.redirect
    } else {
      setLoading(false)
      toast.error(d.error ?? 'Could not start viewing as this user')
    }
  }

  return (
    <button onClick={start} disabled={loading} className="btn-ghost btn-sm" title={`View as ${name}`}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Eye className="w-3 h-3" />} View as
    </button>
  )
}
