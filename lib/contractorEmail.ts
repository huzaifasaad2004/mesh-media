import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

const wrap = (headerTitle: string, headerSub: string, bodyHtml: string) => `
<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
  body { font-family: Inter, Arial, sans-serif; margin:0; background:#f5f5f5; color:#1a1a1a; }
  .wrap { max-width:520px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  .header { background:#6E1318; padding:28px 32px; }
  .header h1 { color:#fff; margin:0; font-size:20px; font-weight:700; }
  .header p { color:rgba(255,255,255,.75); margin:4px 0 0; font-size:13px; }
  .body { padding:28px 32px; font-size:14px; line-height:1.6; }
  .amount-box { background:#faf8f5; border:1px solid #ece7e0; border-left:4px solid #6E1318; border-radius:6px; padding:16px 20px; margin:18px 0; }
  .amount-box .label { font-size:11px; color:#999; text-transform:uppercase; letter-spacing:.06em; }
  .amount-box .amount { font-size:26px; font-weight:700; color:#6E1318; margin-top:2px; }
  .cta { display:inline-block; background:#6E1318; color:#fff !important; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:600; margin:16px 0; font-size:14px; }
  .footer { background:#f9f9f9; border-top:1px solid #eee; padding:16px 32px; font-size:11px; color:#999; text-align:center; }
</style></head><body>
<div class="wrap">
  <div class="header"><h1>${headerTitle}</h1><p>${headerSub}</p></div>
  <div class="body">${bodyHtml}</div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`

export async function sendContractorWelcomeEmail(input: { name: string; email: string | null; contractorUrl: string }) {
  if (!input.email) return { sent: false, error: 'No email on file for this contractor' }
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY not configured' }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to: input.email,
    subject: `Your payment portal — ${COMPANY.name}`,
    html: wrap(COMPANY.name, 'Your personal payment page', `
      <p>Hi ${input.name},</p>
      <p>Here's your personal link to track payments for your work with us — no account or password needed, just keep this link.</p>
      <p>You can see every payment we've made you, download a receipt for each one, and upload project files directly.</p>
      <a href="${input.contractorUrl}" class="cta">Open your payment page →</a>
      <p style="color:#888;font-size:12px;">This link is personal to you — please don't share it. Bookmark it for later.</p>
    `),
  })
  if (error) return { sent: false, error: error.message }
  return { sent: true }
}

export async function sendContractorReceiptEmail(input: {
  name: string; email: string | null; amount: number; currency: string
  description: string | null; paymentDate: string; contractorUrl: string; receiptUrl: string
}) {
  if (!input.email) return { sent: false, error: 'No email on file for this contractor' }
  if (!process.env.RESEND_API_KEY) return { sent: false, error: 'RESEND_API_KEY not configured' }
  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: `MeshMedia Payments <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to: input.email,
    subject: `Payment sent — ${input.currency} ${input.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    html: wrap('Payment Sent', input.description ?? 'Project payment', `
      <p>Hi ${input.name},</p>
      <p>A payment has been made to you.</p>
      <div class="amount-box">
        <div class="label">Amount</div>
        <div class="amount">${input.currency} ${input.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
      </div>
      <p style="color:#888;font-size:13px;">Paid on ${new Date(input.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}${input.description ? ` · ${input.description}` : ''}</p>
      <a href="${input.receiptUrl}" class="cta">View &amp; download receipt →</a>
      <p style="color:#888;font-size:12px;">See your full payment history and upload project files anytime: <a href="${input.contractorUrl}">${input.contractorUrl}</a></p>
    `),
  })
  if (error) return { sent: false, error: error.message }
  return { sent: true }
}
