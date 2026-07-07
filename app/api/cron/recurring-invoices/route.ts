import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { serviceRole } from '@/lib/apiAuth'
import { requireCronOrFinanceWrite } from '@/lib/cron'
import { logActivity } from '@/lib/activityLog'
import { COMPANY, DEFAULT_TERMS } from '@/lib/company'

export const runtime = 'nodejs'

// Generates this month's invoice for every client with a monthly_retainer
// and auto_invoice_retainer=true, that doesn't already have one for the
// current period. Safe to call repeatedly — the unique (client_id,
// retainer_period) index means it can never double-invoice anyone.
async function run(req: NextRequest) {
  const auth = await requireCronOrFinanceWrite(req)
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const today = new Date().toISOString().split('T')[0]
  const period = today.slice(0, 7)
  const dueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const monthLabel = new Date(`${period}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const { data: clients } = await db
    .from('clients')
    .select('id, company_name, email, contact_person, monthly_retainer')
    .eq('auto_invoice_retainer', true)
    .eq('status', 'active')
    .gt('monthly_retainer', 0)

  const generated: string[] = []
  const skipped: string[] = []
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  for (const client of clients ?? []) {
    const { data: existing } = await db.from('invoices').select('id').eq('client_id', client.id).eq('retainer_period', period).maybeSingle()
    if (existing) { skipped.push(client.company_name); continue }

    const { data: invoiceNumber, error: numberErr } = await db.rpc('next_doc_number', { p_kind: 'invoice', p_prefix: 'MM-INV-' })
    if (numberErr || !invoiceNumber) { skipped.push(`${client.company_name} (numbering error)`); continue }

    const { data: invoice, error } = await db.from('invoices').insert({
      invoice_number: invoiceNumber,
      client_id: client.id,
      status: 'sent',
      issue_date: today,
      due_date: dueDate,
      subject: `Monthly Retainer — ${monthLabel}`,
      terms: DEFAULT_TERMS,
      retainer_period: period,
    }).select().single()
    if (error || !invoice) { skipped.push(`${client.company_name} (error)`); continue }

    await db.from('invoice_items').insert({
      invoice_id: invoice.id,
      description: `Monthly retainer — ${monthLabel}`,
      quantity: 1,
      unit_price: client.monthly_retainer,
      amount: client.monthly_retainer,
    })

    if (resend && client.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
      await resend.emails.send({
        from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'invoices@m3m.ae'}>`,
        to: client.email,
        subject: `Invoice ${invoiceNumber} — Monthly Retainer (${monthLabel})`,
        html: `<p>Dear ${client.contact_person ?? client.company_name},</p>
<p>Your monthly retainer invoice for ${monthLabel} is ready.</p>
<p><a href="${baseUrl}/invoice/${invoice.id}">View &amp; pay invoice ${invoiceNumber} →</a></p>
<p>${COMPANY.name}</p>`,
      }).catch(() => {})
    }

    await db.from('notifications').insert(
      (await db.from('profiles').select('id').in('role', ['owner', 'admin'])).data?.map((a) => ({
        user_id: a.id,
        title: `Retainer invoice generated`,
        body: `${client.company_name} · ${invoiceNumber}`,
        href: '/finance/invoices',
      })) ?? []
    )

    generated.push(client.company_name)
  }

  if (auth.user) await logActivity(auth.user, 'run', 'recurring_invoices', null, `${period} · ${generated.length} generated, ${skipped.length} skipped`)

  return NextResponse.json({ success: true, period, generated, skipped })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
