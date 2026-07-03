'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import { navVisible } from '@/lib/roles'
import type { Profile } from '@/types/database'
import NotificationBell from '@/components/NotificationBell'
import {
  LayoutDashboard, Users, CheckSquare, FolderOpen,
  FileText, DollarSign, UserCog, LogOut, Settings, FolderKanban, Inbox
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/clients',    label: 'Clients',     icon: Users },
  { href: '/projects',   label: 'Projects',    icon: FolderKanban },
  { href: '/tasks',      label: 'Tasks',       icon: CheckSquare },
  { href: '/requests',   label: 'Requests',    icon: Inbox },
  { href: '/files',      label: 'Files',       icon: FolderOpen },
  { href: '/contracts',  label: 'Contracts',   icon: FileText },
  { href: '/finance',    label: 'Finance',     icon: DollarSign },
  { href: '/team',       label: 'Team',        icon: UserCog },
  { href: '/settings',   label: 'Settings',    icon: Settings },
]

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-60 bg-paper-100 border-r border-sand-300 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sand-300">
        <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-8 h-9 object-contain flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-ink truncate" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>Mesh Media</p>
          <p className="text-xs text-taupe-500 truncate">Agency OS</p>
        </div>
        <NotificationBell />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.filter(({ href }) => navVisible(profile?.role, href)).map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn('sidebar-link', active && 'active')}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User profile */}
      <div className="px-3 py-4 border-t border-sand-300">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 bg-brand-600 text-paper-100 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {getInitials(profile?.full_name ?? profile?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink truncate">
              {profile?.full_name ?? 'Team Member'}
            </p>
            <p className="text-xs text-taupe-500 truncate capitalize">{profile?.role ?? 'staff'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-taupe-500 hover:text-umber-700 transition-colors p-1 rounded"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
