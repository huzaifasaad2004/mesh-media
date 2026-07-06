'use client'

import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'

export default function ImpersonationBanner({ targetEmail }: { targetEmail: string }) {
  const [loading, setLoading] = useState(false)

  const returnToAdmin = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/impersonate/stop', { method: 'POST' })
    if (res.ok) {
      window.location.href = '/team'
    } else {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[150] flex items-center justify-center gap-3 px-4 py-2 text-sm font-medium text-white"
      style={{ background: 'var(--maroon-dark, #4E0E12)' }}
    >
      <Eye className="w-4 h-4 flex-shrink-0" />
      <span className="truncate">Viewing as {targetEmail}</span>
      <button
        onClick={returnToAdmin}
        disabled={loading}
        className="ml-2 px-3 py-1 rounded-md bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Return to admin
      </button>
    </div>
  )
}
