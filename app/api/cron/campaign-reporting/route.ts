import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrManager } from '@/lib/cron'
import { serviceRole } from '@/lib/apiAuth'
import { syncCampaignConnection, type CampaignConnection } from '@/lib/campaignReporting'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = await requireCronOrManager(req)
  if ('res' in auth) return auth.res
  const db = serviceRole(); const { data: connections } = await db.from('campaign_connections').select('*').eq('status', 'active')
  const until = new Date().toISOString().slice(0, 10); const start = new Date(); start.setDate(start.getDate() - 7)
  const synced: any[] = []
  for (const connection of connections ?? []) {
    try { synced.push({ id: connection.id, imported: await syncCampaignConnection(db, connection as CampaignConnection, start.toISOString().slice(0, 10), until) }) }
    catch (error) { const message = error instanceof Error ? error.message : 'Sync failed'; await db.from('campaign_connections').update({ status: 'error', last_error: message }).eq('id', connection.id); synced.push({ id: connection.id, error: message }) }
  }
  return NextResponse.json({ success: true, synced })
}
