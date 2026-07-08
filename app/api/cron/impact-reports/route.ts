import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { serviceRole } from '@/lib/apiAuth'
import { requireCronOrFinanceWrite } from '@/lib/cron'
import { logActivity } from '@/lib/activityLog'
import { COMPANY } from '@/lib/company'
import { notifyUsers } from '@/lib/notify'
import { computeClientStats } from '@/lib/impactReport'
import { renderImpactReportPdf } from '@/lib/pdf/ImpactReportPdf'

export const runtime = 'nodejs'

// Generates last month's Impact Report PDF for every active client that
// doesn't already have one for that period. Safe to call repeatedly — the
// unique (client_id, period) index on client_reports means it can never
// double-generate a report.
async function run(req: NextRequest) {
  const auth = await requireCronOrFinanceWrite(req)
  if ('res' in auth) return auth.res

  const db = serviceRole()
  // The report always covers the month that just ended, not the one that
  // just started — matches when this runs (1st of the month) and when a
  // manual "Generate" click makes sense mid-month.
  const now = new Date()
  const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const period = lastMonth.toISOString().slice(0, 7)
  const monthLabel = new Date(`${period}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  const { data: clients } = await db
    .from('clients')
    .select('id, company_name, email, contact_person')
    .eq('status', 'active')

  const generated: string[] = []
  const skipped: string[] = []

  for (const client of clients ?? []) {
    const { data: existing } = await db.from('client_reports').select('id').eq('client_id', client.id).eq('period', period).maybeSingle()
    if (existing) { skipped.push(client.company_name); continue }

    const stats = await computeClientStats(db, client.id, period)

    const pdfBuffer = await renderImpactReportPdf({
      clientName: client.company_name,
      period,
      stats,
      baseUrl,
    })

    const storagePath = `${client.id}/${period}.pdf`
    const { error: uploadError } = await db.storage
      .from('client-reports')
      .upload(storagePath, pdfBuffer, { contentType: 'application/pdf', upsert: true })
    if (uploadError) { skipped.push(`${client.company_name} (upload error)`); continue }

    const { data: publicUrl } = db.storage.from('client-reports').getPublicUrl(storagePath)

    const { data: report, error } = await db.from('client_reports').insert({
      client_id: client.id,
      period,
      pdf_url: publicUrl.publicUrl,
      storage_path: storagePath,
      stats,
    }).select().single()
    if (error || !report) { skipped.push(`${client.company_name} (error)`); continue }

    if (resend && client.email) {
      const { error: sendError } = await resend.emails.send({
        from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
        to: client.email,
        subject: `Your ${monthLabel} Impact Report`,
        html: `<p>Dear ${client.contact_person ?? client.company_name},</p>
<p>Here's a look at everything we delivered for you in ${monthLabel}.</p>
<p><a href="${baseUrl}/portal">View your Impact Report in the client portal →</a></p>
<p>${COMPANY.name}</p>`,
        attachments: [{ filename: `Impact-Report-${period}.pdf`, content: pdfBuffer }],
      })
      if (!sendError) await db.from('client_reports').update({ emailed_at: new Date().toISOString() }).eq('id', report.id)
    }

    const { data: cronAdmins } = await db.from('profiles').select('id').in('role', ['owner', 'admin'])
    await notifyUsers(db, {
      userIds: (cronAdmins ?? []).map((a) => a.id),
      title: `Impact report generated`,
      body: `${client.company_name} · ${monthLabel}`,
      href: '/clients',
      category: 'critical_alert',
    })

    generated.push(client.company_name)
  }

  if (auth.user) await logActivity(auth.user, 'run', 'impact_reports', null, `${period} · ${generated.length} generated, ${skipped.length} skipped`)

  return NextResponse.json({ success: true, period, generated, skipped })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
