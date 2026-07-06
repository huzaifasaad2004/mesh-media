import { createClient } from '@/lib/supabase/server'
import type { Client } from '@/types/database'
import ClientsTable from '@/components/clients/ClientsTable'

export default async function ClientsPage() {
  const supabase = createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false })

  return <ClientsTable clients={(clients as Client[]) ?? []} />
}
