import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function GET() {
  const { data, error } = await admin().from('profiles').select('id, full_name, email, role').order('full_name')
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
