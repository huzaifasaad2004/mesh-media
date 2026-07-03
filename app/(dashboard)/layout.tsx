import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/sidebar'
import AiChat from '@/components/AiChat'
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

  // Effective permissions = role defaults with any per-person overrides applied
  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    supabase.from('role_permissions').select('permission').eq('role', profile?.role ?? ''),
    supabase.from('user_permissions').select('permission, granted').eq('user_id', user.id),
  ])
  const effective = new Set((rolePerms ?? []).map(r => r.permission))
  for (const o of overrides ?? []) {
    if (o.granted) effective.add(o.permission)
    else effective.delete(o.permission)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar profile={profile as Profile | null} permissions={Array.from(effective)} />
      <main className="flex-1 ml-60 min-h-screen">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
      <AiChat />
    </div>
  )
}
