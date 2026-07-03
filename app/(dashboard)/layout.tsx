import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import AiChat from '@/components/AiChat'
import { getEffectivePermissions } from '@/lib/permissions'
import type { Profile } from '@/types/database'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Client-portal users never see the staff dashboard
  if (profile?.role === 'client') redirect('/portal')

  // Effective permissions = role defaults with any per-person overrides applied.
  // Depends on migrations (role_permissions/user_permissions) — never let a
  // missing table or transient error take the whole dashboard down.
  let effective = new Set<string>()
  try {
    effective = await getEffectivePermissions(supabase, user.id, profile?.role ?? '')
  } catch { /* schema not migrated yet or transient error — degrade gracefully */ }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile as Profile | null} permissions={Array.from(effective)} />
      <main className="flex-1 lg:ml-60 min-h-screen pt-14 lg:pt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          {children}
        </div>
      </main>
      <AiChat />
    </div>
  )
}
