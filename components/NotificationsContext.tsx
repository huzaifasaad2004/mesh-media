'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface Notification {
  id: string
  title: string
  body: string | null
  href: string | null
  read: boolean
  created_at: string
}

interface NotificationsState {
  items: Notification[]
  unreadCount: number
  /** hrefs of every currently-unread notification — the sidebar checks these
   *  for a prefix match against each nav item to decide whether to show a dot. */
  unreadHrefs: string[]
  markRead: (id: string) => void
  markAllRead: () => void
}

const NotificationsCtx = createContext<NotificationsState | null>(null)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([])
  const supabaseRef = useRef<ReturnType<typeof createClient>>()
  if (!supabaseRef.current) supabaseRef.current = createClient()
  const supabase = supabaseRef.current

  const load = useCallback(async () => {
    try {
      // Unread notifications aren't capped — a sidebar dot for, say, a task
      // assigned two weeks ago shouldn't silently stop working just because
      // 30 newer notifications arrived since. Read ones are capped for the
      // bell panel's display.
      const [{ data: unread }, { data: recentRead }] = await Promise.all([
        supabase.from('notifications').select('*').eq('read', false).order('created_at', { ascending: false }),
        supabase.from('notifications').select('*').eq('read', true).order('created_at', { ascending: false }).limit(20),
      ])
      const merged = [...(unread ?? []), ...(recentRead ?? [])]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 30)
      setItems(merged)
    } catch { /* notifications table may not exist yet — everything just stays empty */ }
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
    } catch { /* realtime unavailable — still works via the initial load */ }
    return () => { if (channel) { try { supabase.removeChannel(channel) } catch { /* noop */ } } }
    // Intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markRead = useCallback((id: string) => {
    setItems((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)))
    supabase.from('notifications').update({ read: true }).eq('id', id).then(() => {})
  }, [supabase])

  const markAllRead = useCallback(() => {
    setItems((p) => p.map((n) => ({ ...n, read: true })))
    supabase.from('notifications').update({ read: true }).eq('read', false).then(() => {})
  }, [supabase])

  const unreadCount = items.filter((n) => !n.read).length
  const unreadHrefs = items.filter((n) => !n.read && n.href).map((n) => n.href as string)

  return (
    <NotificationsCtx.Provider value={{ items, unreadCount, unreadHrefs, markRead, markAllRead }}>
      {children}
    </NotificationsCtx.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsCtx)
  if (!ctx) throw new Error('useNotifications must be used within NotificationsProvider')
  return ctx
}
