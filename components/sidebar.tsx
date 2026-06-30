'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, getInitials } from '@/lib/utils'
import type { Profile } from '@/types/database'
import {
  LayoutDashboard, Users, CheckSquare, FolderOpen,
  FileText, DollarSign, UserCog, LogOut, Building2, Settings
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',  label: 'Dashboard',  icon: LayoutDashboard },
  { href: '/clients',    label: 'Clients',     icon: Users },
  { href: '/tasks',      label: 'Tasks',       icon: CheckSquare },
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
    <aside className="fixed left-0 top-0 h-screen w-60 bg-white border-r border-gray-200 flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">Mesh Media</p>
          <p className="text-xs text-gray-400 truncate">Agency OS</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
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
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
          <div className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {getInitials(profile?.full_name ?? profile?.email)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile?.full_name ?? 'Team Member'}
            </p>
            <p className="text-xs text-gray-400 truncate capitalize">{profile?.role ?? 'staff'}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
