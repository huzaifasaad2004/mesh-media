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
  taxRate?: number
  taxAmount?: number
  total: number
  notes?: string | null
  status?: string
}

function MeshLogo() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width="36" height="36" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
        <rect width="100" height="100" fill={BRAND} rx="8" />
        <text x="50" y="65" fontFamily="Georgia, serif" fontSize="52" fontStyle="italic" fontWeight="700" fill={CREAM} textAnchor="middle">M</text>
      </svg>
      <div>
        <div style={{ fontFamily: 'Cormorant, Georgia, serif', fontWeight: 600, fontSize: 16, color: BRAND, lineHeight: 1.1 }}>MeshMedia</div>
        <div style={{ fontFamily: 'Inter, sans-serif', fontSize: 9, color: '#888', letterSpacing: '0.08em', textTransform: 'uppercase' }}>For Marketing and PR</div>
      </div>
    </div>
  )
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
  subject, client, items, subtotal, taxRate = 0, taxAmount = 0, total, notes,
}: DocumentTemplateProps) {
  const isInvoice = type === 'invoice'
  const docLabel = isInvoice ? 'INVOICE' : 'QUOTE'

  return (
    <div style={{
      background: 'white',
      width: 794,
      minHeight: 1123,
      margin: '0 auto',
      padding: '48px 52px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
      color: '#1a1a1a',
      boxSizing: 'border-box',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40 }}>
        <MeshLogo />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Cormorant, Georgia, serif', fontWeight: 700, fontSize: 52, color: BRAND, lineHeight: 1, letterSpacing: '-1px' }}>
            {docLabel}
          </div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}># {number}</div>
          {isInvoice && (
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance Due</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: BRAND, fontFamily: 'Cormorant, Georgia, serif' }}>AED {fmt(total)}</div>
            </div>
          )}
        </div>
      </div>

      {/* Company + Bill To row */}
      <div style={{ display: 'flex', gap: 60, marginBottom: 32 }}>
        {/* Company details */}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: BRAND, marginBottom: 6 }}>{COMPANY.name}</div>
          <div style={{ color: '#555', lineHeight: 1.7, fontSize: 12 }}>
            <div>{COMPANY.address}</div>
            <div>{COMPANY.city}</div>
            <div>{COMPANY.phone}</div>
            <div>{COMPANY.email}</div>
            <div>{COMPANY.website}</div>
          </div>
        </div>

        {/* Dates */}
        <div style={{ minWidth: 200 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <tbody>
              <tr>
                <td style={{ color: '#888', paddingBottom: 4, paddingRight: 16 }}>{isInvoice ? 'Invoice Date' : 'Quote Date'}</td>
                <td style={{ fontWeight: 500, paddingBottom: 4 }}>{fmtDate(issueDate)}</td>
              </tr>
              {isInvoice && (
                <tr>
                  <td style={{ color: '#888', paddingBottom: 4, paddingRight: 16 }}>Terms</td>
                  <td style={{ fontWeight: 500, paddingBottom: 4 }}>Due on Receipt</td>
                </tr>
              )}
              <tr>
                <td style={{ color: '#888', paddingRight: 16 }}>{dueOrExpiryLabel}</td>
                <td style={{ fontWeight: 500 }}>{fmtDate(dueOrExpiryDate)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill To */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Bill To</div>
        <div style={{ fontWeight: 600, fontSize: 14, color: BRAND }}>{client.company_name}</div>
        {client.contact_person && <div style={{ fontSize: 12, color: '#555' }}>{client.contact_person}</div>}
        {client.address && <div style={{ fontSize: 12, color: '#555' }}>{client.address}</div>}
        {client.email && <div style={{ fontSize: 12, color: '#555' }}>{client.email}</div>}
        {client.phone && <div style={{ fontSize: 12, color: '#555' }}>{client.phone}</div>}
      </div>

      {/* Subject */}
      {subject && (
        <div style={{ marginBottom: 24 }}>
          <span style={{ fontSize: 11, color: '#999', marginRight: 8 }}>Subject:</span>
          <span style={{ fontWeight: 500 }}>{subject}</span>
        </div>
      )}

      {/* Line items table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 24 }}>
        <thead>
          <tr style={{ backgroundColor: BRAND }}>
            <th style={{ width: 36, padding: '10px 12px', textAlign: 'left', color: CREAM, fontSize: 11, fontWeight: 600 }}>#</th>
            <th style={{ padding: '10px 12px', textAlign: 'left', color: CREAM, fontSize: 11, fontWeight: 600 }}>Item & Description</th>
            <th style={{ width: 60, padding: '10px 12px', textAlign: 'right', color: CREAM, fontSize: 11, fontWeight: 600 }}>Qty</th>
            <th style={{ width: 90, padding: '10px 12px', textAlign: 'right', color: CREAM, fontSize: 11, fontWeight: 600 }}>Rate</th>
            <th style={{ width: 100, padding: '10px 12px', textAlign: 'right', color: CREAM, fontSize: 11, fontWeight: 600 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fafafa' : 'white', borderBottom: '1px solid #f0f0f0' }}>
              <td style={{ padding: '10px 12px', fontSize: 12, color: '#666' }}>{idx + 1}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, color: '#1a1a1a' }}>{item.description}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>{fmt(item.unit_price)}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', fontWeight: 500 }}>{fmt(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 28 }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 240 }}>
          <tbody>
            <tr>
              <td style={{ padding: '5px 16px 5px 0', color: '#888', fontSize: 12 }}>Sub Total</td>
              <td style={{ padding: '5px 0', textAlign: 'right', fontSize: 12 }}>{fmt(subtotal)}</td>
            </tr>
            {taxRate > 0 && (
              <tr>
                <td style={{ padding: '5px 16px 5px 0', color: '#888', fontSize: 12 }}>VAT ({taxRate}%)</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontSize: 12 }}>{fmt(taxAmount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: `2px solid ${BRAND}` }}>
              <td style={{ padding: '10px 16px 4px 0', fontWeight: 700, fontSize: 14, color: BRAND }}>Total</td>
              <td style={{ padding: '10px 0 4px', textAlign: 'right', fontWeight: 700, fontSize: 14, color: BRAND }}>AED {fmt(total)}</td>
            </tr>
            {isInvoice && (
              <tr>
                <td style={{ padding: '4px 16px 4px 0', fontWeight: 700, fontSize: 13 }}>Balance Due</td>
                <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700, fontSize: 13 }}>AED {fmt(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Amount in words */}
      <div style={{ backgroundColor: '#faf9f6', border: '1px solid #ede8df', borderRadius: 6, padding: '10px 14px', marginBottom: 28, fontSize: 12 }}>
        <span style={{ color: '#888', marginRight: 8 }}>Total In Words:</span>
        <span style={{ fontWeight: 600, fontStyle: 'italic' }}>{amountToWords(total)}</span>
      </div>

      {/* Bank details */}
      <div style={{ borderTop: '1px solid #eee', paddingTop: 20, marginBottom: 28 }}>
        <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Payment Details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 40px', fontSize: 12 }}>
          <div><span style={{ color: '#888' }}>Account Name: </span><span style={{ fontWeight: 500 }}>{COMPANY.account_name}</span></div>
          <div><span style={{ color: '#888' }}>Bank: </span><span style={{ fontWeight: 500 }}>{COMPANY.bank_name}</span></div>
          <div><span style={{ color: '#888' }}>Account No: </span><span style={{ fontWeight: 500 }}>{COMPANY.account_number}</span></div>
          <div><span style={{ color: '#888' }}>Branch: </span><span style={{ fontWeight: 500 }}>{COMPANY.branch}</span></div>
          <div style={{ gridColumn: '1/-1' }}><span style={{ color: '#888' }}>IBAN: </span><span style={{ fontWeight: 500, letterSpacing: '0.05em' }}>{COMPANY.iban}</span></div>
        </div>
      </div>

      {notes && (
        <div style={{ marginBottom: 28, fontSize: 12 }}>
          <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Notes</div>
          <div style={{ color: '#555' }}>{notes}</div>
        </div>
      )}

      {/* Signature */}
      <div style={{ marginTop: 40 }}>
        <div style={{ borderTop: '1px solid #ccc', width: 180, marginBottom: 6 }} />
        <div style={{ fontFamily: 'Cormorant, Georgia, serif', fontStyle: 'italic', fontSize: 20, color: BRAND }}>{COMPANY.signatory}</div>
        <div style={{ fontSize: 11, color: '#888' }}>Authorized Signature</div>
      </div>
    </div>
  )
}
