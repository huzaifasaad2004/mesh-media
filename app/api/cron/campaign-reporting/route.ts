import { NextRequest, NextResponse } from 'next/server'
import { requireCronOrManager } from '@/lib/cron'
import { serviceRole } from '@/lib/apiAuth'
import { syncCampaignConnection, type CampaignConnection } from '@/lib/campaignReporting'
import { generateCampaignReport } from '@/lib/campaignReportService'

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
  const {data:schedules}=await db.from('campaign_report_schedules').select('*').eq('enabled',true).lte('next_run_at',new Date().toISOString())
  const generated:any[]=[]
  for (const schedule of schedules ?? []) {
    try {
      const yesterday = new Date(); yesterday.setUTCDate(yesterday.getUTCDate() - 1)
      const endDate = new Date(yesterday); const startDate = new Date(yesterday)
      if (schedule.cadence === 'weekly') startDate.setUTCDate(startDate.getUTCDate() - 6)
      else {
        endDate.setUTCDate(0)
        startDate.setTime(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))
      }
      const result = await generateCampaignReport(db, { clientId:schedule.client_id, projectId:schedule.project_id, start:startDate.toISOString().slice(0,10), end:endDate.toISOString().slice(0,10), timezone:schedule.timezone, language:schedule.language, recipients:schedule.recipient_emails, send:true, baseUrl:process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin, status:'approved' })
      const next = new Date(schedule.next_run_at)
      if (schedule.cadence === 'weekly') next.setUTCDate(next.getUTCDate() + 7); else next.setUTCMonth(next.getUTCMonth() + 1)
      await db.from('campaign_report_schedules').update({ last_sent_at:new Date().toISOString(), next_run_at:next.toISOString() }).eq('id', schedule.id)
      generated.push({ schedule:schedule.id, report:result.report.id })
    } catch (error) { generated.push({ schedule:schedule.id, error:error instanceof Error ? error.message : 'Failed' }) }
  }
  return NextResponse.json({ success: true, synced, generated })
}
