'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, CheckCircle2, ExternalLink } from 'lucide-react'
import { useToast } from '@/components/ui/Toast'

export default function IntegrationsPage() {
  const [status, setStatus] = useState<{ configured: boolean; connected: boolean; account: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const searchParams = useSearchParams()
  const toast = useToast()

  const load = useCallback(async () => {
    const res = await fetch('/api/google/oauth')
    if (res.ok) setStatus(await res.json())
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const result = searchParams.get('google')
    if (result === 'connected') toast.success('Google Calendar connected')
    else if (result === 'no_refresh_token') toast.error('Google didn\'t return a refresh token — remove Mesh Media from myaccount.google.com/permissions and try again')
    else if (result === 'error') toast.error('Failed to connect Google Calendar')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const connect = async () => {
    setBusy(true)
    const res = await fetch('/api/google/oauth', { method: 'POST' })
    const data = await res.json()
    setBusy(false)
    if (!res.ok) { toast.error(data.error ?? 'Failed to start Google connection'); return }
    window.location.href = data.url
  }

  const disconnect = async () => {
    if (!confirm('Disconnect Google Calendar? New meetings will need a manually-pasted Meet link until you reconnect.')) return
    setBusy(true)
    const res = await fetch('/api/google/oauth', { method: 'DELETE' })
    setBusy(false)
    if (res.ok) { toast.success('Disconnected'); load() }
    else toast.error('Failed to disconnect')
  }

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-taupe-500 hover:text-umber-700"><ArrowLeft className="w-4 h-4" /></Link>
          <div>
            <h1>Integrations</h1>
            <p className="text-taupe-600 text-sm mt-0.5">Connect external services to Agency OS</p>
          </div>
        </div>
      </div>

      <div className="card p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center flex-shrink-0">
            <CalendarDays className="w-5 h-5 text-brand-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900">Google Calendar</h3>
            <p className="text-sm text-gray-500 mt-1">
              Lets the Meetings module auto-generate a real Google Meet link when you schedule a meeting,
              instead of pasting one in manually.
            </p>

            {status === null ? (
              <p className="text-sm text-gray-400 mt-4">Loading…</p>
            ) : !status.configured ? (
              <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                Not set up yet — add <code className="text-xs bg-yellow-100 px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code>,{' '}
                <code className="text-xs bg-yellow-100 px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code>, and{' '}
                <code className="text-xs bg-yellow-100 px-1 py-0.5 rounded">TOKEN_ENCRYPTION_KEY</code> to your
                environment first — see <span className="font-medium">SETUP.md Step 7</span> for exact steps
                (reuses the same Google Cloud OAuth client already set up for Celine).
              </div>
            ) : status.connected ? (
              <div className="mt-4 flex items-center justify-between bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-sm text-green-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" /> Connected as <strong>{status.account}</strong>
                </p>
                <button onClick={disconnect} disabled={busy} className="btn-secondary btn-sm">Disconnect</button>
              </div>
            ) : (
              <div className="mt-4">
                <button onClick={connect} disabled={busy} className="btn-primary">
                  {busy ? 'Redirecting…' : 'Connect Google Calendar'}
                </button>
                <p className="text-xs text-gray-400 mt-2">
                  You'll be asked to sign in with the Google account whose calendar meetings should be created
                  on (e.g. hello@m3m.ae).
                </p>
              </div>
            )}

            <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-brand-600 inline-flex items-center gap-1 mt-4">
              <ExternalLink className="w-3 h-3" /> Manage app access on your Google Account
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
