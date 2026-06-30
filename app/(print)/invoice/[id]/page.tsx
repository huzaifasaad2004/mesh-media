'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import DocumentTemplate from '@/components/DocumentTemplate'
import { Printer, ArrowLeft } from 'lucide-react'

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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
      Loading…
    </div>
  )
  if (!invoice || invoice.error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' }}>
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

  return (
    <>
      {/* Toolbar — hidden when printing */}
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
          Invoice #{invoice.invoice_number}
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
          type="invoice"
          number={invoice.invoice_number}
          issueDate={invoice.issue_date}
          dueOrExpiryDate={invoice.due_date}
          dueOrExpiryLabel="Due Date"
          subject={invoice.subject ?? invoice.notes}
          client={invoice.client ?? { company_name: 'Unknown' }}
          items={items}
          subtotal={subtotal}
          taxRate={Number(invoice.tax_rate ?? 0)}
          taxAmount={Number(invoice.tax_amount ?? 0)}
          total={Number(invoice.total ?? 0)}
          notes={invoice.subject ? invoice.notes : undefined}
        />
      </div>
    </>
  )
}
