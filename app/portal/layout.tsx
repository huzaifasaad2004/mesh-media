import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortalHeader from '@/components/portal/PortalHeader'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Staff who land here go back to the dashboard
  if (profile && profile.role !== 'client') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-paper-0">
      <PortalHeader name={profile?.full_name ?? user.email ?? 'Client'} />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
