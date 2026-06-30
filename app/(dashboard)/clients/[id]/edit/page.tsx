import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EditClientClient from './EditClientClient'

export default async function EditClientPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: client } = await supabase.from('clients').select('*').eq('id', params.id).single()
  if (!client) notFound()
  return <EditClientClient client={client} />
}
