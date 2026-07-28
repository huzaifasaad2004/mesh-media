'use client'

import { useEffect, useState } from 'react'
import { Bell, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { useNotifications } from '@/components/NotificationsContext'

export default function NotificationBell() {
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)

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
                <Link key={n.id} href={n.href ?? '#'} onClick={() => { markRead(n.id); setOpen(false) }}
                  className="block px-4 py-3 border-b border-paper-200 last:border-0 hover:bg-paper-50 transition-colors relative">
                  {!n.read && <span className="absolute left-1.5 top-4 w-1.5 h-1.5 rounded-full bg-brand-600" />}
                  <p className="text-sm font-medium text-ink pl-2">{n.title}</p>
                  {n.body && <p className="text-xs text-taupe-600 mt-0.5 line-clamp-2 pl-2">{n.body}</p>}
                  <p className="text-[10px] text-taupe-500 mt-1 pl-2">
                    {new Date(n.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </Link>
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
