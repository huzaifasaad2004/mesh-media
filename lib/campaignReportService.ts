import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getCampaignReportData } from '@/lib/campaignReportData'
import { renderCampaignReportPdf } from '@/lib/pdf/CampaignReportPdf'
import { COMPANY } from '@/lib/company'
import { generateCampaignInsights } from '@/lib/campaignInsights'
import { loadCreativeIntelligence } from '@/lib/creativeLab'

export type GenerateCampaignReportOptions = {
  clientId: string; projectId?: string | null; start: string; end: string; timezone?: string
  provider?: string | null; campaign?: string | null; commentary?: string; internalNotes?: string
  language?: 'en'|'ar'|'bilingual'; summary?: any; createdBy?: string | null; status?: string
  recipients?: string[]; send?: boolean; baseUrl: string; audio?: { bytes: Buffer; mime: string } | null
}

export async function generateCampaignReport(db: SupabaseClient, options: GenerateCampaignReportOptions) {
  const [{ data: client }, { data: project }] = await Promise.all([
    db.from('clients').select('id,company_name,email,contact_person').eq('id', options.clientId).single(),
    options.projectId ? db.from('projects').select('id,name').eq('id', options.projectId).single() : Promise.resolve({ data: null }),
  ])
  if (!client) throw new Error('Client not found')
  const data = await getCampaignReportData(db, { clientId:options.clientId, projectId:options.projectId, start:options.start, end:options.end, provider:options.provider, campaign:options.campaign, compare:true })
  try {
    ;(data as any).creativeLab = await loadCreativeIntelligence(db, { clientId:options.clientId, projectId:options.projectId, start:options.start, end:options.end, provider:options.provider, campaign:options.campaign })
  } catch { /* Reports remain available if creative detail is not migrated yet. */ }
  let summary = options.summary
  if (!summary?.summary) { try { summary = await generateCampaignInsights({ clientName:client.company_name, start:options.start, end:options.end, language:options.language, data }) } catch { summary = {} } }
  const pdf = await renderCampaignReportPdf({ clientName:client.company_name, projectName:project?.name, start:options.start, end:options.end, timezone:options.timezone ?? 'Asia/Dubai', commentary:options.commentary, summary, language:options.language, data, baseUrl:options.baseUrl })
  const id = crypto.randomUUID(), pdfPath = `${options.clientId}/${id}.pdf`
  const { error: uploadError } = await db.storage.from('campaign-reports').upload(pdfPath, pdf, { contentType:'application/pdf' }); if (uploadError) throw uploadError
  let audioPath: string|null = null
  if (options.audio) { audioPath = `${options.clientId}/${id}.${options.audio.mime.includes('mp4')?'m4a':'webm'}`; const { error } = await db.storage.from('campaign-reports').upload(audioPath, options.audio.bytes, { contentType:options.audio.mime }); if (error) throw error }
  const expires = new Date(); expires.setFullYear(expires.getFullYear()+1)
  const { data: report, error } = await db.from('campaign_reports').insert({ id, client_id:options.clientId, project_id:options.projectId ?? null, title:`${client.company_name} Campaign Report`, period_start:options.start, period_end:options.end, timezone:options.timezone ?? 'Asia/Dubai', filters:{provider:options.provider ?? null,campaign:options.campaign ?? null}, commentary:options.commentary, internal_notes:options.internalNotes, language:options.language ?? 'en', executive_summary:summary ?? {}, pdf_storage_path:pdfPath, audio_storage_path:audioPath, status:options.status ?? 'review', public_expires_at:expires.toISOString(), created_by:options.createdBy ?? null }).select().single(); if (error) throw error
  const recipients = (options.recipients?.length ? options.recipients : [client.email]).filter(Boolean) as string[]
  if (options.send && recipients.length) {
    if (!process.env.RESEND_API_KEY) throw new Error('Email delivery is not configured')
    const reportUrl = `${options.baseUrl}/campaign-report/${report.public_token}`
    const attachments:any[]=[{filename:`Campaign-Report-${options.start}-to-${options.end}.pdf`,content:pdf}]
    if(options.audio&&options.audio.bytes.length<15_000_000)attachments.push({filename:`Voice-Note.${options.audio.mime.includes('mp4')?'m4a':'webm'}`,content:options.audio.bytes})
    const { error: emailError } = await new Resend(process.env.RESEND_API_KEY).emails.send({from:`MeshMedia <${process.env.RESEND_FROM_EMAIL??'hello@m3m.ae'}>`,to:recipients,subject:`${client.company_name} campaign performance report · ${options.start} to ${options.end}`,html:`<p>Dear ${client.contact_person??client.company_name},</p><p>Your campaign performance report is ready.</p><p><a href="${reportUrl}">View the interactive report</a></p><p>A PDF copy is also attached.</p><p>Kind regards,<br>${COMPANY.name}</p>`,attachments}); if(emailError)throw emailError
    await db.from('campaign_reports').update({status:'sent',sent_to:recipients.join(','),sent_at:new Date().toISOString()}).eq('id',id)
  }
  return { report, pdf, data }
}
