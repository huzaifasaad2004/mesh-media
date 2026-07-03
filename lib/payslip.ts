import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'

interface PayslipInput {
  employeeName: string
  employeeEmail: string | null
  amount: number
  currency: string
  period: string // 'YYYY-MM'
  paymentDate: string
  payPeriodLabel: string
  paymentId: string
}

function monthLabel(period: string) {
  return new Date(`${period}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}

export async function sendPayslipEmail(input: PayslipInput): Promise<{ sent: boolean; error?: string }> {
  if (!input.employeeEmail) return { sent: false, error: 'No email on file for this team member' }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const payslipUrl = `${baseUrl}/payslip/${input.paymentId}`

  const { error } = await resend.emails.send({
    from: `MeshMedia Payroll <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
    to: input.employeeEmail,
    subject: `Payslip — ${monthLabel(input.period)}`,
    html: `
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
  <div class="header"><h1>Payslip</h1><p>${monthLabel(input.period)}</p></div>
  <div class="body">
    <p>Hi ${input.employeeName},</p>
    <p>Your salary for <strong>${monthLabel(input.period)}</strong> has been processed.</p>
    <div class="amount-box">
      <div class="label">Net Pay (${input.payPeriodLabel})</div>
      <div class="amount">${input.currency} ${input.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    </div>
    <p style="color:#888;font-size:13px;">Paid on ${new Date(input.paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
    <a href="${payslipUrl}" class="cta">View &amp; download payslip →</a>
  </div>
  <div class="footer">${COMPANY.name} · ${COMPANY.email} · ${COMPANY.phone}</div>
</div>
</body></html>`,
  })

  if (error) return { sent: false, error: error.message }
  return { sent: true }
}
