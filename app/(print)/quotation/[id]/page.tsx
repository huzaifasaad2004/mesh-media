'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import DocumentTemplate from '@/components/DocumentTemplate'
import { Printer, Download, Mail, MessageCircle, ArrowLeft, Loader2, Check } from 'lucide-react'
import { COMPANY } from '@/lib/company'

const BRAND = '#6E1318'

export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [quote, setQuote] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailMsg, setEmailMsg] = useState('')

  const sendEmail = async () => {
    setEmailState('sending')
    try {
      const res = await fetch(`/api/quotations/${id}/send`, { method: 'POST' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error ?? 'Send failed')
      setEmailState('sent'); setEmailMsg(`Sent to ${d.to}`)
      setTimeout(() => setEmailState('idle'), 5000)
    } catch (e: any) {
      setEmailState('error'); setEmailMsg(e.message)
      setTimeout(() => setEmailState('idle'), 5000)
    }
  }

  useEffect(() => {
    fetch(`/api/quotations/${id}`)
      .then(r => r.json())
      .then(d => { setQuote(d); setLoading(false) })
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'Inter, sans-serif' }}>
      Loading quotation…
    </div>
  )
  if (!quote || quote.error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'Inter, sans-serif' }}>
      Quotation not found
    </div>
  )

  const items = (quote.items ?? []).map((i: any) => ({
    description: i.description,
    quantity: Number(i.quantity),
    unit_price: Number(i.unit_price),
    amount: Number(i.amount),
  }))
  const subtotal = items.reduce((s: number, i: any) => s + i.amount, 0)
  const total = Number(quote.total ?? 0)
  const client = quote.client ?? { company_name: 'Unknown' }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const waText = encodeURIComponent(
    `Hello ${client.company_name}, please find your quotation *${quote.quote_number}* for *AED ${total.toLocaleString()}*.\n\nView & download here: ${pageUrl}`
  )

  const btnStyle = (bg: string, color: string): React.CSSProperties => ({
    background: bg, border: 'none', color,
    padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
    textDecoration: 'none', whiteSpace: 'nowrap',
  })

  return (
    <>
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
          Quote #{quote.quote_number} · {client.company_name}
        </span>

        {/* Email — sends directly through the software via Resend */}
        {client.email && (
          <button onClick={sendEmail} disabled={emailState === 'sending'}
            style={btnStyle(
              emailState === 'sent' ? '#25a05a' : emailState === 'error' ? '#c0392b' : 'rgba(255,255,255,0.15)',
              'white'
            )}
            title={emailState === 'error' ? emailMsg : `Email this quotation to ${client.email}`}>
            {emailState === 'sending' ? <Loader2 size={13} className="animate-spin" />
              : emailState === 'sent' ? <Check size={13} />
              : <Mail size={13} />}
            {emailState === 'sending' ? 'Sending…'
              : emailState === 'sent' ? emailMsg
              : emailState === 'error' ? 'Failed — retry'
              : 'Send Email'}
          </button>
        )}

        {client.phone && (
          <a href={`https://wa.me/${(client.phone as string).replace(/\D/g, '')}?text=${waText}`}
            target="_blank" rel="noopener noreferrer"
            style={btnStyle('#25D366', 'white')}>
            <MessageCircle size={13} /> WhatsApp
          </a>
        )}

        <button onClick={() => window.print()} style={btnStyle('rgba(255,255,255,0.2)', 'white')}>
          <Printer size={13} /> Print
        </button>

        <button onClick={() => {
          const el = document.querySelector('.no-print') as HTMLElement
          if (el) el.style.display = 'none'
          window.print()
          if (el) el.style.display = ''
        }} style={btnStyle('white', BRAND)}>
          <Download size={13} /> Download PDF
        </button>
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

      <div style={{ paddingTop: 60, background: '#f0ede8', minHeight: '100vh' }}>
        <div style={{ paddingBottom: 40 }}>
          <DocumentTemplate
            type="quotation"
            number={quote.quote_number}
            issueDate={quote.issue_date}
            dueOrExpiryDate={quote.expiry_date}
            dueOrExpiryLabel="Expiry Date"
            subject={quote.subject}
            client={client}
            items={items}
            subtotal={subtotal}
            taxRate={Number(quote.tax_rate ?? 0)}
            taxAmount={Number(quote.tax_amount ?? 0)}
            total={total}
            notes={quote.notes}
            terms={quote.terms}
          />
        </div>
      </div>
    </>
  )
}
