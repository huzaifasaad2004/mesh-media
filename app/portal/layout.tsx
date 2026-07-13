import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PortalHeader from '@/components/portal/PortalHeader'
import { getImpersonationInfo } from '@/lib/impersonation'
import ImpersonationBanner from '@/components/ImpersonationBanner'

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

  // Portal can be suspended per-client without deleting the invite/login.
  // Degrades gracefully if phase18_portal_access.sql hasn't been applied yet.
  const { data: mapping } = await supabase
    .from('client_contacts')
    .select('client:clients(portal_enabled)')
    .eq('user_id', user.id)
    .maybeSingle()
  const clientRecord = mapping?.client as unknown as { portal_enabled?: boolean } | null
  const impersonation = getImpersonationInfo()

  if (clientRecord && clientRecord.portal_enabled === false) {
    return (
      <div className="min-h-screen bg-paper-0 flex items-center justify-center px-4">
        {impersonation && <ImpersonationBanner targetEmail={impersonation.target_email} />}
        <div className="text-center max-w-sm">
          <h1 className="font-display text-2xl text-ink mb-2">Portal access paused</h1>
          <p className="text-sm text-taupe-500">Your account team has temporarily paused portal access. Please contact us if you believe this is a mistake.</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-paper-0 ${impersonation ? 'pt-9' : ''}`}>
      {impersonation && <ImpersonationBanner targetEmail={impersonation.target_email} />}
      <PortalHeader name={profile?.full_name ?? user.email ?? 'Client'} avatarUrl={profile?.avatar_url} profileHref="/portal/profile" />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
