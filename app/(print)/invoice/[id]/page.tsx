'use client'

import { Suspense, useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import DocumentTemplate from '@/components/DocumentTemplate'
import { Printer, Download, Mail, MessageCircle, ArrowLeft, Loader2, Check, CreditCard } from 'lucide-react'
import { COMPANY } from '@/lib/company'
import { waitForImages } from '@/lib/waitForImages'

const BRAND = '#6E1318'

export default function InvoicePrintPage() {
  return (
    <Suspense fallback={null}>
      <InvoicePrintContent />
    </Suspense>
  )
}

function InvoicePrintContent() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [preparingPrint, setPreparingPrint] = useState(false)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailMsg, setEmailMsg] = useState('')
  const [payState, setPayState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [payError, setPayError] = useState('')

  const payNow = async () => {
    setPayState('loading'); setPayError('')
    try {
      const res = await fetch(`/api/invoices/${id}/checkout`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Could not start payment')
      window.location.href = d.url
    } catch (e: any) {
      setPayState('error'); setPayError(e.message)
      setTimeout(() => setPayState('idle'), 5000)
    }
  }

  // window.print() captures a snapshot of the DOM right when it's called — if
  // the logo/signature images haven't finished decoding yet (very common on
  // a fresh load), that spot renders blank in the printed/saved PDF. Wait for
  // every image to actually be ready first. The .no-print toolbar is already
  // hidden purely via the @media print CSS rule, so no DOM mutation is needed
  // here — mutating styles right before print() risks the browser capturing
  // a mid-reflow, blank frame instead.
  const printNow = async () => {
    setPreparingPrint(true)
    await waitForImages()
    setPreparingPrint(false)
    window.print()
  }

  const sendEmail = async () => {
    setEmailState('sending')
    try {
      const res = await fetch(`/api/invoices/${id}/send`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Send failed')
      setEmailState('sent'); setEmailMsg(`Sent to ${d.to}`)
      setTimeout(() => setEmailState('idle'), 5000)
    } catch (e: any) {
      setEmailState('error'); setEmailMsg(e.message)
      setTimeout(() => setEmailState('idle'), 5000)
    }
  }

  const searchParams = useSearchParams()
  const justPaid = searchParams.get('paid') === '1'

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(r => r.json())
      .then(d => { setInvoice(d); setLoading(false) })
  }, [id])

  // Stripe redirects back immediately after payment — the webhook that marks
  // the invoice paid can land a beat later, so poll once to pick up the
  // confirmed status instead of showing stale "unpaid" data.
  useEffect(() => {
    if (!justPaid) return
    const t = setTimeout(() => {
      fetch(`/api/invoices/${id}`).then(r => r.json()).then(setInvoice)
    }, 2500)
    return () => clearTimeout(t)
  }, [justPaid, id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'Inter, sans-serif' }}>
      Loading invoice…
    </div>
  )
  if (!invoice || invoice.error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'Inter, sans-serif' }}>
      Invoice not found
    </div>
  )

  const items = (invoice.items ?? []).map((i: any) => ({
    description: i.description,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    amount: Number(i.amount),
  }))
  const subtotal = items.reduce((s: number, i: any) => s + i.amount, 0)
  const discountAmount = invoice.discount_type === 'percent' ? subtotal * (Number(invoice.discount_value ?? 0) / 100)
    : invoice.discount_type === 'flat' ? Number(invoice.discount_value ?? 0) : 0
  const total = Number(invoice.total ?? 0)
  const client = invoice.client ?? { company_name: 'Unknown' }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const waText = encodeURIComponent(
    `Hello ${client.company_name}, please find your invoice *${invoice.invoice_number}* for *AED ${total.toLocaleString()}*.\n\nView & download here: ${pageUrl}`
  )

  const btnStyle = (bg: string, color: string): React.CSSProperties => ({
    background: bg, border: 'none', color,
    padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
    textDecoration: 'none', whiteSpace: 'nowrap',
  })

  return (
    <>
      {/* Toolbar — hidden when printing */}
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: BRAND, padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={() => window.history.back()} style={btnStyle('rgba(255,255,255,0.15)', 'white')}>
          <ArrowLeft size={13} /> Back
        </button>

        <span style={{ color: 'rgba(255,255,255,0.5)', margin: '0 4px' }}>|</span>

        <span style={{ color: 'white', fontWeight: 600, fontSize: 13, flex: 1 }}>
          Invoice #{invoice.invoice_number} · {client.company_name}
        </span>

        {/* Pay now — Stripe Checkout, only while there's still a balance due */}
        {!['paid', 'cancelled'].includes(invoice.status) && (
          <button onClick={payNow} disabled={payState === 'loading'}
            style={btnStyle('#25a05a', 'white')}
            title={payState === 'error' ? payError : 'Pay online with a card'}>
            {payState === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
            {payState === 'loading' ? 'Redirecting…' : payState === 'error' ? 'Payment failed' : 'Pay Now'}
          </button>
        )}

        {/* Email — sends directly through the software via Resend */}
        {client.email && (
          <button onClick={sendEmail} disabled={emailState === 'sending'}
            style={btnStyle(
              emailState === 'sent' ? '#25a05a' : emailState === 'error' ? '#c0392b' : 'rgba(255,255,255,0.15)',
              'white'
            )}
            title={emailState === 'error' ? emailMsg : `Email this invoice to ${client.email}`}>
            {emailState === 'sending' ? <Loader2 size={13} className="animate-spin" />
              : emailState === 'sent' ? <Check size={13} />
              : <Mail size={13} />}
            {emailState === 'sending' ? 'Sending…'
              : emailState === 'sent' ? emailMsg
              : emailState === 'error' ? 'Failed — retry'
              : 'Send Email'}
          </button>
        )}

        {/* WhatsApp — always available; without a phone on file it opens
            WhatsApp's contact picker with the message prefilled */}
        <a href={client.phone
            ? `https://wa.me/${(client.phone as string).replace(/\D/g, '')}?text=${waText}`
            : `https://wa.me/?text=${waText}`}
          target="_blank" rel="noopener noreferrer"
          style={btnStyle('#25D366', 'white')}
          title={client.phone ? `WhatsApp ${client.phone}` : 'No phone on file — choose the contact in WhatsApp'}>
          <MessageCircle size={13} /> WhatsApp
        </a>

        {/* Print */}
        <button onClick={printNow} disabled={preparingPrint} style={btnStyle('rgba(255,255,255,0.2)', 'white')}>
          {preparingPrint ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Print
        </button>

        {/* Download PDF — a real server-generated .pdf file, no print dialog */}
        <a href={`/api/invoices/${id}/pdf`} style={btnStyle('white', BRAND)}>
          <Download size={13} /> Download PDF
        </a>
      </div>

      {emailState === 'error' && (
        <div className="no-print" style={{
          position: 'fixed', top: 48, left: 0, right: 0, zIndex: 99,
          background: '#c0392b', color: 'white', padding: '8px 20px',
          fontSize: 12, fontFamily: 'Inter, sans-serif',
        }}>
          Email failed: {emailMsg}
        </div>
      )}

      {invoice.status === 'partially_paid' && (
        <div className="no-print" style={{
          position: 'fixed', top: 48, left: 0, right: 0, zIndex: 99,
          background: '#B8801F', color: 'white', padding: '8px 20px',
          fontSize: 12, fontFamily: 'Inter, sans-serif',
        }}>
          Partially paid: AED {Number(invoice.amount_paid ?? 0).toLocaleString()} of {total.toLocaleString()} received — AED {(total - Number(invoice.amount_paid ?? 0)).toLocaleString()} remaining.
        </div>
      )}

      {justPaid && (
        <div className="no-print" style={{
          position: 'fixed', top: 48, left: 0, right: 0, zIndex: 99,
          background: invoice.status === 'paid' ? '#25a05a' : '#B8801F', color: 'white', padding: '8px 20px',
          fontSize: 12, fontFamily: 'Inter, sans-serif',
        }}>
          {invoice.status === 'paid' ? 'Payment received — thank you!' : 'Payment successful — confirming with our system…'}
        </div>
      )}

      <div className="print-page-wrap" style={{ paddingTop: 60, background: '#f0ede8', minHeight: '100vh' }}>
        <div style={{ paddingBottom: 40 }}>
          <DocumentTemplate
            type="invoice"
            number={invoice.invoice_number}
            issueDate={invoice.issue_date}
            dueOrExpiryDate={invoice.due_date}
            dueOrExpiryLabel="Due Date"
            subject={invoice.subject}
            client={client}
            items={items}
            subtotal={subtotal}
            discountAmount={discountAmount}
            taxRate={Number(invoice.tax_rate ?? 0)}
            taxAmount={Number(invoice.tax_amount ?? 0)}
            total={total}
            notes={invoice.notes}
            terms={invoice.terms}
          />
        </div>
      </div>
    </>
  )
}
