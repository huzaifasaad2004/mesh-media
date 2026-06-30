'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import DocumentTemplate from '@/components/DocumentTemplate'
import { Printer, ArrowLeft } from 'lucide-react'

export default function QuotationPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [quote, setQuote] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/quotations/${id}`)
      .then(r => r.json())
      .then(d => { setQuote(d); setLoading(false) })
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
      Loading…
    </div>
  )
  if (!quote || quote.error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
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

  return (
    <>
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: '#6E1318', padding: '10px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <button onClick={() => window.history.back()} style={{
          background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
          padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
        }}>
          <ArrowLeft size={14} /> Back
        </button>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 14 }}>
          Quote #{quote.quote_number}
        </span>
        <button onClick={() => window.print()} style={{
          background: 'white', border: 'none', color: '#6E1318',
          padding: '6px 18px', borderRadius: 6, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
        }}>
          <Printer size={14} /> Print / Save PDF
        </button>
      </div>

      <div style={{ paddingTop: 56 }}>
        <DocumentTemplate
          type="quotation"
          number={quote.quote_number}
          issueDate={quote.issue_date}
          dueOrExpiryDate={quote.expiry_date}
          dueOrExpiryLabel="Expiry Date"
          subject={quote.subject}
          client={quote.client ?? { company_name: 'Unknown' }}
          items={items}
          subtotal={subtotal}
          taxRate={Number(quote.tax_rate ?? 0)}
          taxAmount={Number(quote.tax_amount ?? 0)}
          total={Number(quote.total ?? 0)}
          notes={quote.notes}
        />
      </div>
    </>
  )
}
