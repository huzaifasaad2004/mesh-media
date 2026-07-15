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
  return <ClientsTable clients={(clients as Client[]) ?? []} isManagerUp={isManagerUp} />
}
