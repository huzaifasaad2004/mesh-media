'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import { navVisible } from '@/lib/roles'
import type { Profile } from '@/types/database'
import NotificationBell from '@/components/NotificationBell'
import ThemeToggle from '@/components/ThemeToggle'
import { useNotifications } from '@/components/NotificationsContext'
import {
  LayoutDashboard, Users, CheckSquare, FolderOpen,
  FileText, DollarSign, UserCog, LogOut, Settings, FolderKanban, Inbox, Clock, CheckCircle2, Wallet,
  Menu, X, Search, FileSignature, ImageUp, HardHat, Filter, Newspaper, BookOpen, Video, MessageCircle
} from 'lucide-react'

const openCommandPalette = () => window.dispatchEvent(new Event('mm:open-command-palette'))

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/crm',        label: 'CRM',         icon: Filter },
  { href: '/clients',    label: 'Clients',     icon: Users },
  { href: '/projects',   label: 'Projects',    icon: FolderKanban },
  { href: '/tasks',      label: 'Tasks',       icon: CheckSquare },
  { href: '/chat',       label: 'Chat',        icon: MessageCircle },
  { href: '/meetings',   label: 'Meetings',    icon: Video },
  { href: '/content',    label: 'Content',     icon: ImageUp },
  { href: '/media',      label: 'Media Coverage', icon: Newspaper },
  { href: '/knowledge',  label: 'Knowledge Base', icon: BookOpen },
  { href: '/time',       label: 'Time',        icon: Clock },
  { href: '/approvals',  label: 'Approvals',   icon: CheckCircle2 },
  { href: '/requests',   label: 'Requests',    icon: Inbox },
  { href: '/my-pay',     label: 'My Pay',      icon: Wallet },
  { href: '/files',      label: 'Files',       icon: FolderOpen },
  { href: '/contracts',  label: 'Contracts',   icon: FileText },
  { href: '/documents',  label: 'Documents',   icon: FileSignature },
  { href: '/finance',    label: 'Finance',     icon: DollarSign },
  { href: '/contractors', label: 'Contractors', icon: HardHat },
  { href: '/team',       label: 'Team',        icon: UserCog },
  { href: '/settings',   label: 'Settings',    icon: Settings },
]

interface SidebarProps {
  profile: Profile | null
  permissions?: string[]
}

export function Sidebar({ profile, permissions }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { unreadHrefs } = useNotifications()
  const hasUnread = (href: string) => unreadHrefs.some((h) => h === href || h.startsWith(`${href}?`) || h.startsWith(`${href}/`))

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const visibleItems = navItems.filter(({ href }) => navVisible(profile?.role, href, permissions))

  return (
    <>
      {/* Mobile top bar — hidden on lg+ where the persistent sidebar takes over */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-paper-100 border-b border-sand-300 flex items-center justify-between px-3"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <button onClick={() => setMobileOpen(true)} className="p-2 -ml-1 text-umber-700" aria-label="Open menu">
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-6 h-7 object-contain" />
          <span className="text-base font-semibold text-ink" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Mesh Media</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={openCommandPalette} className="p-2 text-umber-700" aria-label="Search (⌘K)">
            <Search className="w-4.5 h-4.5" />
          </button>
          <NotificationBell />
        </div>
      </header>

      {/* Overlay behind the mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — persistent on lg+, slide-in drawer below lg */}
      <aside className={cn(
        'fixed left-0 top-0 h-screen w-64 lg:w-60 bg-paper-100 border-r border-sand-300 flex flex-col z-50',
        'transition-transform duration-200 ease-in-out',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sand-300" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1.25rem)' }}>
          <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-8 h-9 object-contain flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-ink truncate" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Mesh Media</p>
            <p className="text-xs text-taupe-500 truncate">Agency OS</p>
          </div>
          <div className="hidden lg:block"><NotificationBell /></div>
          <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1 text-taupe-500" aria-label="Close menu">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search / command palette trigger */}
        <div className="hidden lg:block px-3 pt-3">
          <button
            onClick={openCommandPalette}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-sand-300 text-taupe-500 text-xs hover:border-brand-300 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="text-[10px] border border-sand-300 rounded px-1 py-0.5">⌘K</kbd>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn('sidebar-link relative', active && 'active')}
                style={{ minHeight: 44 }}
              >
                <span className="relative flex-shrink-0">
                  <Icon className="w-4 h-4" />
                  {hasUnread(href) && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-danger" style={{ background: 'var(--danger)' }} />
                  )}
                </span>
                {label}
              </Link>
            )
          })}
        </nav>

        {/* User profile */}
        <div className="px-3 py-4 border-t border-sand-300" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}>
          <div className="flex items-center gap-1 px-1 py-1 rounded-lg">
            <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 flex-1 min-w-0 px-2 py-1 rounded-lg hover:bg-paper-200 transition-colors">
              <div className="w-8 h-8 bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 overflow-hidden">
                {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : getInitials(profile?.full_name ?? profile?.email)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-ink truncate">
                  {profile?.full_name ?? 'Team Member'}
                </p>
                <p className="text-xs text-taupe-500 truncate capitalize">{profile?.role ?? 'staff'}</p>
              </div>
            </Link>
            <ThemeToggle />
            <button
              onClick={handleSignOut}
              className="text-taupe-500 hover:text-umber-700 transition-colors p-2 rounded flex-shrink-0"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
