import { Resend } from 'resend'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY } from '@/lib/company'
import { renderDocumentPdf } from '@/lib/pdf/DocumentPdf'
import { escapeHtml } from '@/lib/utils'

const CLAIM_TIMEOUT_MS = 10 * 60 * 1000

/** Sends a paid-invoice receipt once. Failures are released for a later retry
 * and deliberately never roll back the payment that triggered the email. */
export async function sendPaymentReceiptBestEffort(db: SupabaseClient, invoiceId: string) {
  if (!process.env.RESEND_API_KEY) return

  const staleBefore = new Date(Date.now() - CLAIM_TIMEOUT_MS).toISOString()
  const claimedAt = new Date().toISOString()
  const { data: claim } = await db.from('invoices')
    .update({ payment_receipt_claimed_at: claimedAt })
    .eq('id', invoiceId)
    .eq('status', 'paid')
    .is('payment_receipt_sent_at', null)
    .or(`payment_receipt_claimed_at.is.null,payment_receipt_claimed_at.lt.${staleBefore}`)
    .select('*, client:clients(company_name, email, contact_person, phone, address), items:invoice_items(*)')
    .maybeSingle()
  if (!claim) return

  try {
    const email = claim.client?.email
    if (!email) throw new Error('Client has no email address')

    const paidDate = claim.paid_date ?? new Date().toISOString().slice(0, 10)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.m3m.ae'
    const items = (claim.items ?? []).map((item: any) => ({
      description: item.description, quantity: Number(item.quantity),
      unit_price: Number(item.unit_price), amount: Number(item.amount),
    }))
    const subtotal = items.reduce((sum: number, item: any) => sum + item.amount, 0)
    const discountAmount = claim.discount_type === 'percent'
      ? subtotal * (Number(claim.discount_value ?? 0) / 100)
      : claim.discount_type === 'flat' ? Number(claim.discount_value ?? 0) : 0
    const pdf = await renderDocumentPdf({
      type: 'receipt', number: claim.invoice_number, issueDate: paidDate,
      dueOrExpiryLabel: 'Payment Date',
      subject: claim.subject, client: claim.client, items,
      subtotal, discountAmount,
      taxRate: Number(claim.tax_rate ?? 0), taxAmount: Number(claim.tax_amount ?? 0),
      total: Number(claim.total), status: 'paid', amountPaid: Number(claim.amount_paid ?? claim.total),
      paidDate, notes: `Payment received in full for invoice ${claim.invoice_number}.`, baseUrl,
    })
    const safeNumber = String(claim.invoice_number).replace(/[^a-zA-Z0-9_-]/g, '-')
    const resend = new Resend(process.env.RESEND_API_KEY)
    const { data, error } = await resend.emails.send({
      from: `MeshMedia <${process.env.RESEND_FROM_EMAIL ?? 'hello@m3m.ae'}>`,
      to: email,
      subject: `Payment received - Invoice ${claim.invoice_number}`,
      attachments: [{ filename: `Payment-Receipt-${safeNumber}.pdf`, content: pdf }],
      html: `<!doctype html><html><body style="margin:0;background:#f3eee6;font-family:Arial,sans-serif;color:#151312"><div style="max-width:560px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden"><div style="background:#6E1318;padding:24px 30px;color:#fff"><div style="font-size:20px;font-weight:700">${COMPANY.name}</div><div style="font-size:12px;opacity:.8;margin-top:4px">PAYMENT RECEIPT</div></div><div style="padding:30px"><div style="display:inline-block;background:#e8f5ed;color:#238B57;padding:7px 12px;border-radius:999px;font-weight:700;font-size:12px">PAID IN FULL</div><h2 style="font-size:20px;margin:18px 0 8px">Thank you for your payment</h2><p style="color:#555;line-height:1.6">Dear ${escapeHtml(claim.client.contact_person || claim.client.company_name)}, we received <strong>AED ${Number(claim.total).toLocaleString('en-AE', { minimumFractionDigits: 2 })}</strong> for invoice ${escapeHtml(claim.invoice_number)} on ${escapeHtml(paidDate)}.</p><p style="color:#555;line-height:1.6">Your official branded receipt is attached to this email for your records.</p></div><div style="border-top:1px solid #eee;padding:16px 30px;color:#9C9384;font-size:11px">${COMPANY.website} · ${COMPANY.email}</div></div></body></html>`,
    }, { idempotencyKey: `invoice-paid-receipt/${invoiceId}` })
    if (error) throw error
    await db.from('invoices').update({
      payment_receipt_sent_at: new Date().toISOString(),
      payment_receipt_email_id: data?.id ?? null,
      payment_receipt_claimed_at: null,
    }).eq('id', invoiceId).eq('payment_receipt_claimed_at', claimedAt)
  } catch (error) {
    console.error('Payment receipt email failed:', error instanceof Error ? error.message : 'Unknown error')
    await db.from('invoices').update({ payment_receipt_claimed_at: null })
      .eq('id', invoiceId).eq('payment_receipt_claimed_at', claimedAt)
  }
}
