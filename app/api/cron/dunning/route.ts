import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { serviceRole } from '@/lib/apiAuth'
import { requireCronOrFinanceWrite } from '@/lib/cron'
import { logActivity } from '@/lib/activityLog'
import { COMPANY } from '@/lib/company'
import { escapeHtml } from '@/lib/utils'

export const runtime = 'nodejs'

// Escalating overdue reminders — polite on day 0, firm at 7 days overdue,
// final notice at 14. Stops automatically once an invoice is no longer
// 'overdue' (paid/cancelled), since it's excluded from the query below.
const STAGES = [
  { stage: 1, minDaysOverdue: 0, subjectPrefix: 'Payment Reminder', tone: 'polite' as const },
  { stage: 2, minDaysOverdue: 7, subjectPrefix: 'Second Reminder — Payment Overdue', tone: 'firm' as const },
  { stage: 3, minDaysOverdue: 14, subjectPrefix: 'Final Notice — Payment Seriously Overdue', tone: 'final' as const },
]

function bodyFor(tone: 'polite' | 'firm' | 'final', clientName: string, invoiceNumber: string, amount: string, dueDate: string, url: string) {
  if (tone === 'polite') {
    return `<p>Dear ${clientName},</p>
<p>This is a friendly reminder that invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> was due on ${dueDate} and hasn't been paid yet.</p>
<p><a href="${url}">View &amp; pay invoice →</a></p>
<p>If you've already sent payment, please disregard this note. Thank you!</p>
<p>${COMPANY.name}</p>`
  }
  if (tone === 'firm') {
    return `<p>Dear ${clientName},</p>
<p>Invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> (due ${dueDate}) remains unpaid. This is now more than a week overdue — please arrange payment as soon as possible.</p>
<p><a href="${url}">View &amp; pay invoice →</a></p>
<p>Please contact us if there's an issue we should know about.</p>
<p>${COMPANY.name}</p>`
  }
  return `<p>Dear ${clientName},</p>
<p><strong>Final notice:</strong> invoice <strong>${invoiceNumber}</strong> for <strong>${amount}</strong> (due ${dueDate}) is now significantly overdue and services may be paused if payment isn't received shortly.</p>
<p><a href="${url}">View &amp; pay invoice →</a></p>
<p>Please reach out immediately if you'd like to discuss.</p>
<p>${COMPANY.name}</p>`
}

async function run(req: NextRequest) {
  const auth = await requireCronOrFinanceWrite(req)
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const today = new Date().toISOString().split('T')[0]

  // Flip anything past due into 'overdue' first, so the query below is accurate.
  await db.from('invoices').update({ status: 'overdue' }).eq('status', 'sent').lt('due_date', today)

  const { data: overdue } = await db
    .from('invoices')
    .select('id, invoice_number, total, due_date, dunning_stage, client:clients(company_name, email, contact_person)')
    .eq('status', 'overdue')

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin

  const sent: string[] = []
  const skipped: string[] = []

  for (const inv of overdue ?? []) {
    const client = inv.client as any
    if (!client?.email) { skipped.push(`${inv.invoice_number} (no client email)`); continue }

    const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (24 * 60 * 60 * 1000))
    const target = [...STAGES].reverse().find((s) => daysOverdue >= s.minDaysOverdue)
    if (!target || target.stage <= inv.dunning_stage) { skipped.push(`${inv.invoice_number} (not due for next stage)`); continue }

    const amount = `AED ${Number(inv.total).toLocaleString('en-AE', { minimumFractionDigits: 2 })}`
    const dueDateLabel = new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const url = `${baseUrl}/invoice/${inv.id}`
    const clientName = escapeHtml(client.contact_person ?? client.company_name)

    if (resend) {
      const { error: sendError } = await resend.emails.send({
        from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'invoices@m3m.ae'}>`,
        to: client.email,
        subject: `${target.subjectPrefix}: Invoice ${inv.invoice_number}`,
        html: bodyFor(target.tone, clientName, inv.invoice_number, amount, dueDateLabel, url),
      })
      if (sendError) { skipped.push(`${inv.invoice_number} (send failed)`); continue }
    }

    await db.from('invoices').update({ dunning_stage: target.stage, last_reminder_sent_at: new Date().toISOString() }).eq('id', inv.id)
    sent.push(`${inv.invoice_number} (stage ${target.stage})`)
  }

  if (auth.user) await logActivity(auth.user, 'run', 'dunning', null, `${sent.length} reminders sent, ${skipped.length} skipped`)

  return NextResponse.json({ success: true, sent, skipped })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
