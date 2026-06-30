import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const resend = new Resend(process.env.RESEND_API_KEY)

  const { data: inv, error } = await admin()
    .from('invoices')
    .select('*, client:clients(company_name, email, contact_person), items:invoice_items(*)')
    .eq('id', params.id)
    .single()

  if (error || !inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
  if (!inv.client?.email) return NextResponse.json({ error: 'Client has no email address' }, { status: 400 })

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://mesh-media.vercel.app'
  const invoiceUrl = `${baseUrl}/invoice/${params.id}`
  const clientName = inv.client.contact_person ?? inv.client.company_name

  const { error: sendError } = await resend.emails.send({
    from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'invoices@m3m.ae'}>`,
    to: inv.client.email,
    subject: `Invoice ${inv.invoice_number} from MeshMedia`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
  body { font-family: Inter, Arial, sans-serif; margin: 0; background: #f5f5f5; color: #1a1a1a; }
  .wrap { max-width: 560px; margin: 32px auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .header { background: #6E1318; padding: 28px 32px; }
  .header h1 { color: white; margin: 0; font-size: 22px; font-weight: 700; }
  .header p { color: rgba(255,255,255,0.75); margin: 4px 0 0; font-size: 13px; }
  .body { padding: 28px 32px; }
  .amount-box { background: #faf8f5; border: 1px solid #ece7e0; border-left: 4px solid #6E1318; border-radius: 6px; padding: 16px 20px; margin: 20px 0; }
  .amount-box .label { font-size: 11px; color: #999; text-transform: uppercase; letter-spacing: 0.06em; }
  .amount-box .amount { font-size: 28px; font-weight: 700; color: #6E1318; margin-top: 2px; }
  .cta { display: block; text-align: center; background: #6E1318; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 24px 0; }
  table.details { width: 100%; border-collapse: collapse; font-size: 13px; }
  table.details td { padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
  table.details td:last-child { text-align: right; font-weight: 500; }
  .footer { background: #f9f9f9; border-top: 1px solid #eee; padding: 16px 32px; font-size: 11px; color: #999; text-align: center; }
</style></head>
<body>
<div class="wrap">
  <div class="header">
    <h1>Invoice ${inv.invoice_number}</h1>
    <p>${COMPANY.name}</p>
  </div>
  <div class="body">
    <p>Dear ${clientName},</p>
    <p>Please find your invoice from MeshMedia. You can view, download, or pay directly using the link below.</p>
    <div class="amount-box">
      <div class="label">Amount Due</div>
      <div class="amount">AED ${Number(inv.total).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</div>
    </div>
    ${inv.due_date ? `<p style="color:#888;font-size:13px;">Due by: <strong style="color:#1a1a1a;">${new Date(inv.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong></p>` : ''}
    <a href="${invoiceUrl}" class="cta">View &amp; Download Invoice →</a>
    <table class="details">
      ${(inv.items ?? []).slice(0, 5).map((item: any) => `
      <tr><td>${item.description}</td><td>AED ${Number(item.amount).toLocaleString()}</td></tr>`).join('')}
      <tr style="font-weight:700;font-size:14px;"><td>Total</td><td>AED ${Number(inv.total).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</td></tr>
    </table>
    <p style="margin-top:24px;font-size:13px;color:#555;">
      <strong>Bank Transfer:</strong><br>
      Account: ${COMPANY.account_name}<br>
      IBAN: ${COMPANY.iban}<br>
      Bank: ${COMPANY.bank_name}
    </p>
  </div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}<br>Trade License: ${COMPANY.trade_license}</div>
</div>
</body>
</html>`,
  })

  if (sendError) return NextResponse.json({ error: sendError.message }, { status: 500 })

  // Auto-update status to 'sent'
  await admin().from('invoices').update({ status: 'sent' }).eq('id', params.id)

  return NextResponse.json({ success: true, to: inv.client.email })
}
