'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import DocumentTemplate from '@/components/DocumentTemplate'
import { Printer, Download, Mail, MessageCircle, ArrowLeft } from 'lucide-react'
import { COMPANY } from '@/lib/company'

const BRAND = '#6E1318'

export default function InvoicePrintPage() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then(r => r.json())
      .then(d => { setInvoice(d); setLoading(false) })
  }, [id])

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
  const total = Number(invoice.total ?? 0)
  const client = invoice.client ?? { company_name: 'Unknown' }

  const pageUrl = typeof window !== 'undefined' ? window.location.href : ''
  const emailSubject = encodeURIComponent(`Invoice ${invoice.invoice_number} from MeshMedia`)
  const emailBody = encodeURIComponent(
    `Dear ${client.company_name},\n\nPlease find your invoice ${invoice.invoice_number} for AED ${total.toLocaleString()}.\n\nView & download: ${pageUrl}\n\nThank you for your business.\n\nMeshMedia\n${COMPANY.phone}`
  )
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

        {/* Email */}
        {client.email && (
          <a href={`mailto:${client.email}?subject=${emailSubject}&body=${emailBody}`}
            style={btnStyle('rgba(255,255,255,0.15)', 'white')}>
            <Mail size={13} /> Email
          </a>
        )}

        {/* WhatsApp */}
        {client.phone && (
          <a href={`https://wa.me/${(client.phone as string).replace(/\D/g, '')}?text=${waText}`}
            target="_blank" rel="noopener noreferrer"
            style={btnStyle('#25D366', 'white')}>
            <MessageCircle size={13} /> WhatsApp
          </a>
        )}

        {/* Print */}
        <button onClick={() => window.print()} style={btnStyle('rgba(255,255,255,0.2)', 'white')}>
          <Printer size={13} /> Print
        </button>

        {/* Download PDF */}
        <button onClick={() => {
          const el = document.querySelector('.no-print') as HTMLElement
          if (el) el.style.display = 'none'
          window.print()
          if (el) el.style.display = ''
        }} style={btnStyle('white', BRAND)}>
          <Download size={13} /> Download PDF
        </button>
      </div>

      <div style={{ paddingTop: 60, background: '#f0ede8', minHeight: '100vh' }}>
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
