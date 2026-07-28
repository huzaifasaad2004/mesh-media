import { NextRequest, NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'
import { getStripe } from '@/lib/stripe'
import { logActivity } from '@/lib/activityLog'
import type { User } from '@supabase/supabase-js'
import { sendPaymentReceiptBestEffort } from '@/lib/paymentReceipt'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 })

  let stripe
  try {
    stripe = getStripe()
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 503 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  const body = await req.text()
  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (e: any) {
    return NextResponse.json({ error: `Invalid signature: ${e.message}` }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as { metadata?: Record<string, string> | null; payment_intent?: string | null }
    const invoiceId = session.metadata?.invoice_id
    if (invoiceId) {
      const db = serviceRole()
      const { data: invoice } = await db.from('invoices').select('id, status, invoice_number, total, amount_paid').eq('id', invoiceId).single()
      // Idempotent — Stripe can send this event more than once.
      if (invoice && invoice.status !== 'paid') {
        const paymentDate = new Date().toISOString().split('T')[0]
        const remaining = Number(invoice.total) - Number(invoice.amount_paid ?? 0)
        await db.from('invoice_payments').insert({
          invoice_id: invoiceId,
          amount: remaining,
          payment_date: paymentDate,
          notes: 'Paid online via Stripe',
        })
        await db.from('invoices').update({
          status: 'paid',
          amount_paid: invoice.total,
          paid_date: paymentDate,
          dunning_stage: 0,
          last_reminder_sent_at: null,
        }).eq('id', invoiceId)

        // Attribute the log entry to the system, not a signed-in user — this
        // is a webhook, there's no authenticated actor.
        const systemActor = { id: null, email: 'stripe-webhook' } as unknown as User
        await logActivity(systemActor, 'pay', 'invoice', invoiceId, `${invoice.invoice_number} · paid online via Stripe`)
      }
      if (invoice) await sendPaymentReceiptBestEffort(db, invoiceId)
    }
  }

  return NextResponse.json({ received: true })
}
