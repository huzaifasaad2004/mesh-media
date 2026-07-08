'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Bell, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Notification {
  id: string
  title: string
  body: string | null
  href: string | null
  read: boolean
  created_at: string
}

export default function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  // Stable client for this component's lifetime
  const supabaseRef = useRef<ReturnType<typeof createClient>>()
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(15)
      setItems(data ?? [])
    } catch { /* notifications table may not exist yet — bell just stays empty */ }
  }, [supabase])

  useEffect(() => {
    load()
    // A UNIQUE channel name per mount is essential: reusing a fixed name
    // returns the cached, already-subscribed channel on a re-mount, and
    // calling .on() after .subscribe() throws — which previously crashed
    // the whole app. try/catch is a further safety net so realtime being
    // unavailable can never take the UI down.
    let channel: ReturnType<typeof supabase.channel> | null = null
    try {
      channel = supabase
        .channel(`notifications-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => load())
        .subscribe()
    } catch { /* realtime unavailable — the bell still works via the initial load */ }
    return () => { if (channel) { try { supabase.removeChannel(channel) } catch { /* noop */ } } }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unread = items.filter(n => !n.read).length

  const markAllRead = async () => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('read', false)
      setItems(p => p.map(n => ({ ...n, read: true })))
    } catch { /* noop */ }
  }

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(o => !o); if (!open && unread > 0) markAllRead() }}
        className="relative p-1.5 rounded-lg text-taupe-600 hover:bg-paper-200 hover:text-ink transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-brand-600 text-paper-100 text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-9 z-50 w-72 card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-paper-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-taupe-600 uppercase tracking-wider">Notifications</span>
              <Link href="/notification-preferences" onClick={() => setOpen(false)} title="Notification settings"
                className="text-taupe-500 hover:text-ink">
                <Settings className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length > 0 ? items.map(n => (
                <Link key={n.id} href={n.href ?? '#'} onClick={() => setOpen(false)}
                  className="block px-4 py-3 border-b border-paper-200 last:border-0 hover:bg-paper-50 transition-colors">
                  <p className="text-sm font-medium text-ink">{n.title}</p>
                  {n.body && <p className="text-xs text-taupe-600 mt-0.5 line-clamp-2">{n.body}</p>}
                  <p className="text-[10px] text-taupe-500 mt-1">
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
