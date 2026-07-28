import { createClient } from '@/lib/supabase/server'
import type { Client } from '@/types/database'
import ClientsTable from '@/components/clients/ClientsTable'

export default async function ClientsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  const isManagerUp = ['owner', 'admin', 'manager'].includes(profile?.role ?? '')
  const canViewAsClient = ['owner', 'admin'].includes(profile?.role ?? '')
  const portalUserByClient: Record<string, { id: string; full_name: string | null; email: string | null }> = {}

  if (canViewAsClient) {
    const { data: mappings } = await supabase.from('client_contacts').select('client_id, user_id')
    const userIds = Array.from(new Set((mappings ?? []).map(mapping => mapping.user_id)))
    if (userIds.length) {
      const { data: portalUsers } = await supabase.from('profiles').select('id, full_name, email').in('id', userIds).eq('role', 'client')
      const usersById = new Map((portalUsers ?? []).map(portalUser => [portalUser.id, portalUser]))
      for (const mapping of mappings ?? []) {
        const portalUser = usersById.get(mapping.user_id)
        // One clear entry point per client is enough for the list. Clients
        // with multiple portal users remain fully manageable on their detail page.
        if (portalUser && !portalUserByClient[mapping.client_id]) portalUserByClient[mapping.client_id] = portalUser
      }
    }
  }

  return <ClientsTable clients={(clients as Client[]) ?? []} isManagerUp={isManagerUp} portalUserByClient={portalUserByClient} />
}
