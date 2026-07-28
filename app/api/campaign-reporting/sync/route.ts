import { NextRequest, NextResponse } from 'next/server'
import { MANAGERS, requireRoles, serviceRole } from '@/lib/apiAuth'
import { syncCampaignConnection, type CampaignConnection } from '@/lib/campaignReporting'

export async function POST(req: NextRequest) {
  const auth = await requireRoles(MANAGERS)
  if ('res' in auth) return auth.res
  const { connectionId } = await req.json().catch(() => ({}))
  if (!connectionId) return NextResponse.json({ error: 'Connection is required' }, { status: 400 })
  const db = serviceRole(); const { data: connection } = await db.from('campaign_connections').select('*').eq('id', connectionId).single()
  if (!connection) return NextResponse.json({ error: 'Connection not found' }, { status: 404 })
  const until = new Date().toISOString().slice(0, 10); const start = new Date(); start.setDate(start.getDate() - 30)
  try { const imported = await syncCampaignConnection(db, connection as CampaignConnection, start.toISOString().slice(0, 10), until); return NextResponse.json({ success: true, imported }) }
  catch (error) { const message = error instanceof Error ? error.message : 'Sync failed'; await db.from('campaign_connections').update({ status: 'error', last_error: message }).eq('id', connectionId); return NextResponse.json({ error: message }, { status: 400 }) }
}
