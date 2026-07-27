'use client'

import { amountToWords } from '@/lib/numberToWords'
import { COMPANY } from '@/lib/company'

const BRAND = '#6E1318'
const CREAM = '#F3EEE6'

interface LineItem {
  description: string
  quantity: number
  unit_price: number
  amount: number
}

interface DocumentTemplateProps {
  type: 'invoice' | 'quotation'
  number: string
  issueDate: string
  dueOrExpiryDate?: string | null
  dueOrExpiryLabel: string
  subject?: string | null
  client: {
    company_name: string
    address?: string | null
    email?: string | null
    phone?: string | null
    contact_person?: string | null
  }
  items: LineItem[]
  subtotal: number
  discountAmount?: number
  taxRate?: number
  taxAmount?: number
  total: number
  status?: string | null
  amountPaid?: number
  paidDate?: string | null
  notes?: string | null
  terms?: string | null
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s))
}

export default function DocumentTemplate({
  type, number, issueDate, dueOrExpiryDate, dueOrExpiryLabel,
  subject, client, items, subtotal, discountAmount = 0, taxRate = 0, taxAmount = 0, total,
  status, amountPaid = 0, paidDate, notes, terms,
}: DocumentTemplateProps) {
  const isInvoice = type === 'invoice'
  const isPaid = isInvoice && status === 'paid'
  const balanceDue = isPaid ? 0 : Math.max(0, total - amountPaid)
  const docLabel = isInvoice ? 'INVOICE' : 'QUOTATION'

  return (
    <div style={{
      background: 'white',
      width: 794,
      minHeight: 1123,
      maxWidth: 794,
      margin: '0 auto',
      padding: '26px 46px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 12.5,
      color: '#1a1a1a',
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {isPaid && (
        <div aria-label="Paid in full" style={{
          position: 'absolute', top: 38, right: -54, width: 210,
          transform: 'rotate(38deg)', background: '#238B57', color: 'white',
          padding: '9px 0', textAlign: 'center', fontSize: 15, fontWeight: 800,
          letterSpacing: '0.16em', boxShadow: '0 2px 7px rgba(0,0,0,0.16)', zIndex: 2,
        }}>
          PAID
        </div>
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        {/* Real logo — larger for visibility on the printed page */}
        <img
          src="/logo.jpg"
          alt="MeshMedia"
          style={{ height: 72, width: 'auto', objectFit: 'contain' }}
        />
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Cormorant, Georgia, serif', fontWeight: 700,
            fontSize: 46, color: BRAND, lineHeight: 1, letterSpacing: '-1px',
          }}>
            {docLabel}
          </div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>#{number}</div>
          {isInvoice && (
            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <div style={{ fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance Due</div>
              <div style={{ fontSize: 19, fontWeight: 700, color: BRAND, fontFamily: 'Cormorant, Georgia, serif' }}>
                AED {fmt(balanceDue)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: `2px solid ${BRAND}`, marginBottom: 16 }} />

      {/* ── Company info + Dates ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 12.5, color: BRAND, marginBottom: 4 }}>{COMPANY.name}</div>
          <div style={{ color: '#555', lineHeight: 1.5, fontSize: 11.5 }}>
            <div>{COMPANY.address}</div>
            <div>{COMPANY.city}</div>
            <div>{COMPANY.phone}</div>
            <div>{COMPANY.email}</div>
            <div>{COMPANY.website}</div>
          </div>
        </div>

        <div style={{ minWidth: 200, textAlign: 'right' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, marginLeft: 'auto' }}>
            <tbody>
              <tr>
                <td style={{ color: '#888', paddingBottom: 5, paddingRight: 12 }}>{isInvoice ? 'Invoice Date' : 'Quote Date'}</td>
                <td style={{ fontWeight: 600, paddingBottom: 5 }}>{fmtDate(issueDate)}</td>
              </tr>
              {isInvoice && (
                <tr>
                  <td style={{ color: '#888', paddingBottom: 5, paddingRight: 12 }}>Terms</td>
                  <td style={{ fontWeight: 600, paddingBottom: 5 }}>Due on Receipt</td>
                </tr>
              )}
              {dueOrExpiryDate && (
                <tr>
                  <td style={{ color: '#888', paddingRight: 12 }}>{dueOrExpiryLabel}</td>
                  <td style={{ fontWeight: 600 }}>{fmtDate(dueOrExpiryDate)}</td>
                </tr>
              )}
              {isPaid && paidDate && (
                <tr>
                  <td style={{ color: '#238B57', paddingTop: 5, paddingRight: 12 }}>Paid Date</td>
                  <td style={{ fontWeight: 700, color: '#238B57', paddingTop: 5 }}>{fmtDate(paidDate)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Bill To ── */}
      <div style={{
        backgroundColor: '#faf8f5', border: `1px solid ${CREAM}`,
        borderLeft: `4px solid ${BRAND}`, borderRadius: 4,
        padding: '9px 16px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          {isInvoice ? 'Bill To' : 'Prepared For'}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: BRAND }}>{client.company_name}</div>
        {client.contact_person && <div style={{ fontSize: 11.5, color: '#444', marginTop: 1 }}>{client.contact_person}</div>}
        {client.address && <div style={{ fontSize: 11.5, color: '#555' }}>{client.address}</div>}
        {client.email && <div style={{ fontSize: 11.5, color: '#555' }}>{client.email}</div>}
        {client.phone && <div style={{ fontSize: 11.5, color: '#555' }}>{client.phone}</div>}
      </div>

      {/* ── Subject ── */}
      {subject && (
        <div style={{ marginBottom: 12, fontSize: 11.5 }}>
          <span style={{ color: '#999', marginRight: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 9.5 }}>Subject:</span>
          <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{subject}</span>
        </div>
      )}

      {/* ── Line items table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr style={{ backgroundColor: BRAND }}>
            <th style={{ width: 30, padding: '7px 12px', textAlign: 'left', color: CREAM, fontSize: 10.5, fontWeight: 600 }}>#</th>
            <th style={{ padding: '7px 12px', textAlign: 'left', color: CREAM, fontSize: 10.5, fontWeight: 600 }}>Item & Description</th>
            <th style={{ width: 50, padding: '7px 12px', textAlign: 'right', color: CREAM, fontSize: 10.5, fontWeight: 600 }}>Qty</th>
            <th style={{ width: 85, padding: '7px 12px', textAlign: 'right', color: CREAM, fontSize: 10.5, fontWeight: 600 }}>Rate</th>
            <th style={{ width: 95, padding: '7px 12px', textAlign: 'right', color: CREAM, fontSize: 10.5, fontWeight: 600 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fafaf9' : 'white', borderBottom: '1px solid #f0ebe6' }}>
              <td style={{ padding: '6px 12px', fontSize: 11.5, color: '#888' }}>{idx + 1}</td>
              <td style={{ padding: '6px 12px', fontSize: 11.5 }}>{item.description}</td>
              <td style={{ padding: '6px 12px', fontSize: 11.5, textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '6px 12px', fontSize: 11.5, textAlign: 'right' }}>{fmt(item.unit_price)}</td>
              <td style={{ padding: '6px 12px', fontSize: 11.5, textAlign: 'right', fontWeight: 500 }}>{fmt(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 240 }}>
          <tbody>
            <tr>
              <td style={{ padding: '3px 20px 3px 0', color: '#888', fontSize: 11.5 }}>Sub Total</td>
              <td style={{ padding: '3px 0', textAlign: 'right', fontSize: 11.5 }}>AED {fmt(subtotal)}</td>
            </tr>
            {discountAmount > 0 && (
              <tr>
                <td style={{ padding: '3px 20px 3px 0', color: '#888', fontSize: 11.5 }}>Discount</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontSize: 11.5, color: '#b23a2e' }}>−AED {fmt(discountAmount)}</td>
              </tr>
            )}
            {taxRate > 0 && (
              <tr>
                <td style={{ padding: '3px 20px 3px 0', color: '#888', fontSize: 11.5 }}>VAT ({taxRate}%)</td>
                <td style={{ padding: '3px 0', textAlign: 'right', fontSize: 11.5 }}>AED {fmt(taxAmount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: `2px solid ${BRAND}` }}>
              <td style={{ padding: '7px 20px 3px 0', fontWeight: 700, fontSize: 14, color: BRAND }}>Total</td>
              <td style={{ padding: '7px 0 3px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: BRAND }}>AED {fmt(total)}</td>
            </tr>
            {isInvoice && (
              <tr>
                <td style={{ padding: '3px 20px 0 0', fontWeight: 600, fontSize: 12 }}>Balance Due</td>
                <td style={{ padding: '3px 0 0', textAlign: 'right', fontWeight: 600, fontSize: 12, color: isPaid ? '#238B57' : undefined }}>AED {fmt(balanceDue)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Amount in words ── */}
      <div style={{
        backgroundColor: '#faf8f5', border: `1px solid ${CREAM}`,
        borderRadius: 5, padding: '6px 14px', marginBottom: 14, fontSize: 11.5,
      }}>
        <span style={{ color: '#888', marginRight: 8 }}>Total In Words:</span>
        <span style={{ fontWeight: 600, fontStyle: 'italic', color: BRAND }}>{amountToWords(total)}</span>
      </div>

      {/* ── Bank details (invoices only, single-line layout) ── */}
      {isInvoice && (
        <div style={{ borderTop: '1px solid #ece7e0', paddingTop: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>
            Payment Details
          </div>
          <div style={{ fontSize: 11.5, lineHeight: 1.4, color: '#333' }}>
            <div><span style={{ color: '#888', display: 'inline-block', width: 125 }}>Account Name</span><span style={{ fontWeight: 500 }}>{COMPANY.account_name}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 125 }}>Account Number</span><span style={{ fontWeight: 500 }}>{COMPANY.account_number}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 125 }}>IBAN</span><span style={{ fontWeight: 600, letterSpacing: '0.03em' }}>{COMPANY.iban}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 125 }}>Bank</span><span style={{ fontWeight: 500 }}>{COMPANY.bank_name}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 125 }}>Branch</span><span style={{ fontWeight: 500 }}>{COMPANY.branch}</span></div>
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {notes && (
        <div style={{ marginBottom: 10, fontSize: 11.5 }}>
          <div style={{ fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Notes</div>
          <div style={{ color: '#555', lineHeight: 1.45 }}>{notes}</div>
        </div>
      )}

      {/* ── Terms & Conditions ── */}
      {terms && (
        <div style={{ marginBottom: 14, fontSize: 10.5 }}>
          <div style={{ fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Terms & Conditions</div>
          <div style={{ color: '#666', lineHeight: 1.35, whiteSpace: 'pre-line' }}>{terms}</div>
        </div>
      )}

      {/* ── Signature ── */}
      <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <img
          src="/signature.png"
          alt="Signature"
          style={{ height: 52, width: 'auto', objectFit: 'contain', marginBottom: 3, display: 'block' }}
        />
        <div style={{ borderTop: '1px solid #bbb', width: 190, paddingTop: 5 }}>
          <div style={{ fontWeight: 600, fontSize: 11.5, color: '#1a1a1a' }}>{COMPANY.signatory}</div>
          <div style={{ fontSize: 10.5, color: '#888' }}>Authorized Signature</div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop: 16, borderTop: '1px solid #ece7e0', paddingTop: 8,
        display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#bbb',
      }}>
        <span>{COMPANY.name} · TL# {COMPANY.trade_license}</span>
        <span>{COMPANY.email} · {COMPANY.website}</span>
      </div>
    </div>
  )
}
