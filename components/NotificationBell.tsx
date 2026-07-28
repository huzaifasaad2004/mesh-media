'use client'

import { useEffect, useState } from 'react'
import { Bell, Check, MessageSquare, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { useNotifications } from '@/components/NotificationsContext'

export default function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead, refresh } = useNotifications()
  const [open, setOpen] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [errorNotification, setErrorNotification] = useState<string | null>(null)

  async function runAction(id: string, action: string) {
    setBusy(`${id}:${action}`); setError(null); setErrorNotification(null)
    try {
      const res = await fetch(`/api/notifications/${id}/action`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reply: action === 'reply' ? reply : undefined }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? 'Action failed')
      setReplyingTo(null); setReply(''); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : 'Action failed'); setErrorNotification(id) }
    finally { setBusy(null) }
  }

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-lg text-taupe-600 hover:bg-paper-200 hover:text-ink transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
        aria-controls="notification-panel"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-600 text-paper-100 text-[9px] font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/20 sm:bg-transparent" onClick={() => setOpen(false)} />
          <div
            id="notification-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Notifications"
            className="fixed inset-x-3 top-[calc(env(safe-area-inset-top)+4rem)] bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[70] card overflow-hidden flex flex-col sm:absolute sm:inset-auto sm:right-0 sm:top-9 sm:w-80 sm:max-h-[28rem]"
          >
            <div className="px-4 py-2.5 border-b border-paper-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-taupe-600 uppercase tracking-wider">Notifications</span>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-[11px] text-taupe-500 hover:text-brand-600">Mark all read</button>
                )}
                <Link href="/notification-preferences" onClick={() => setOpen(false)} title="Notification settings"
                  className="w-9 h-9 -my-2 flex items-center justify-center rounded-lg text-taupe-500 hover:text-ink hover:bg-paper-100"
                  aria-label="Notification settings">
                  <Settings className="w-3.5 h-3.5" />
                </Link>
                <button onClick={() => setOpen(false)}
                  className="sm:hidden w-9 h-9 -my-2 -mr-2 flex items-center justify-center rounded-lg text-taupe-500 hover:text-ink hover:bg-paper-100"
                  aria-label="Close notifications">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
              {items.length > 0 ? items.map(n => (
                <div key={n.id} className="px-4 py-3 border-b border-paper-200 last:border-0 hover:bg-paper-50 transition-colors relative">
                  {!n.read && <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-brand-600" />}
                  <Link href={n.href ?? '#'} onClick={() => { markRead(n.id); setOpen(false) }} className="block pl-2">
                    <p className="text-sm font-medium text-ink">{n.title}</p>
                    {n.body && <p className="text-xs text-taupe-600 mt-0.5 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-taupe-500 mt-1">{new Date(n.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                  </Link>
                  {n.available_actions?.length > 0 && !n.action_completed_at ? (
                    <div className="pl-2 mt-2 flex flex-wrap gap-1.5">
                      {n.available_actions.includes('approve') && <button disabled={!!busy} onClick={() => runAction(n.id, 'approve')} className="btn-primary !px-2.5 !py-1.5 !text-[11px]"><Check className="w-3 h-3" /> Approve</button>}
                      {n.available_actions.includes('reject') && <button disabled={!!busy} onClick={() => runAction(n.id, 'reject')} className="btn-secondary !px-2.5 !py-1.5 !text-[11px]">Reject</button>}
                      {n.available_actions.includes('complete') && <button disabled={!!busy} onClick={() => runAction(n.id, 'complete')} className="btn-primary !px-2.5 !py-1.5 !text-[11px]"><Check className="w-3 h-3" /> Complete</button>}
                      {n.available_actions.includes('reply') && <button disabled={!!busy} onClick={() => { setReplyingTo(n.id); setError(null) }} className="btn-secondary !px-2.5 !py-1.5 !text-[11px]"><MessageSquare className="w-3 h-3" /> Reply</button>}
                    </div>
                  ) : null}
                  {replyingTo === n.id ? <div className="pl-2 mt-2 flex gap-1.5"><input autoFocus value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && reply.trim()) runAction(n.id, 'reply') }} maxLength={2000} placeholder="Write a reply..." className="input !py-1.5 !text-xs flex-1 min-w-0" /><button disabled={!reply.trim() || !!busy} onClick={() => runAction(n.id, 'reply')} className="btn-primary !px-2.5 !py-1.5 !text-[11px]">Send</button></div> : null}
                  {error && errorNotification === n.id ? <p className="pl-2 mt-1 text-[11px] text-red-600">{error}</p> : null}
                </div>
              )) : (
                <p className="px-4 py-8 text-center text-sm text-taupe-500">No notifications yet</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
