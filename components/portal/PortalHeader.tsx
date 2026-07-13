'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { getInitials } from '@/lib/utils'

export default function PortalHeader({ name, avatarUrl, tag = 'Client portal', profileHref }: { name: string; avatarUrl?: string | null; tag?: string; profileHref?: string | null }) {
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="border-b border-paper-200 bg-paper-0">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" className="w-7 h-8 object-contain flex-shrink-0" />
          <span className="text-lg font-semibold text-ink" style={{ fontFamily: 'var(--font-cormorant), Georgia, serif' }}>
            Mesh Media
          </span>
          <span className="text-xs text-taupe-500 border-l border-sand-300 pl-2.5 ml-0.5 hidden sm:inline">{tag}</span>
        </div>
        <div className="flex items-center gap-3">
          {profileHref ? (
            <Link href={profileHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-full bg-brand-600 text-paper-100 flex items-center justify-center text-xs font-semibold overflow-hidden">
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
              </div>
              <span className="text-sm text-umber-700 hidden sm:inline">{name}</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-600 text-paper-100 flex items-center justify-center text-xs font-semibold overflow-hidden">
                {avatarUrl ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" /> : getInitials(name)}
              </div>
              <span className="text-sm text-umber-700 hidden sm:inline">{name}</span>
            </div>
          )}
          <button onClick={signOut} className="text-taupe-500 hover:text-umber-700 p-1.5 rounded-lg hover:bg-paper-200 transition-colors" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
