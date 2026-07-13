import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortalHeader from '@/components/portal/PortalHeader'

export default async function ContractorPortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'client') redirect('/portal')
  if (profile?.role !== 'contractor') redirect('/dashboard')

  return (
    <div className="min-h-screen bg-paper-0">
      <PortalHeader name={profile?.full_name ?? user.email ?? 'Contractor'} avatarUrl={profile?.avatar_url} tag="Contractor portal" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
