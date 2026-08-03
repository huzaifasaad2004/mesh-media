import { NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'
import { getCampaignReportData } from '@/lib/campaignReportData'
import { loadCreativeIntelligence } from '@/lib/creativeLab'

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const db = serviceRole()
  const { data: report } = await db.from('campaign_reports')
    .select('*,client:clients(company_name),project:projects(name)')
    .eq('public_token', params.token).maybeSingle()
  if (!report || report.public_expires_at && new Date(report.public_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Report link is invalid or expired' }, { status: 404 })
  }
  const data = await getCampaignReportData(db, {
    clientId: report.client_id, projectId: report.project_id,
    start: report.period_start, end: report.period_end,
    provider: report.filters?.provider, campaign: report.filters?.campaign, compare: true,
  })
  try {
    const lab = await loadCreativeIntelligence(db, {
      clientId: report.client_id, projectId: report.project_id,
      start: report.period_start, end: report.period_end,
      provider: report.filters?.provider, campaign: report.filters?.campaign,
    })
    // A client report receives measured findings, never internal fingerprint notes
    // or the raw platform payload used to calculate them.
    ;(data as any).creativeLab = {
      summary: lab.summary,
      patterns: lab.patterns,
      recommendations: lab.recommendations,
      creatives: lab.creatives.map(({ notes, previous, creative, fingerprint, ...safe }) => safe),
    }
  } catch { /* Older reports remain readable before the Creative Lab migration. */ }
  await db.from('campaign_reports').update({ opened_at: new Date().toISOString(), open_count: (report.open_count ?? 0) + 1 }).eq('id', report.id)
  return NextResponse.json({
    report: {
      id: report.id, title: report.title, start: report.period_start, end: report.period_end,
      timezone: report.timezone, language: report.language, commentary: report.commentary,
      summary: report.executive_summary, client: report.client, project: report.project,
      audio: Boolean(report.audio_storage_path),
    },
    data,
  })
}
