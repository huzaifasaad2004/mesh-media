'use client'

import { amountToWords } from '@/lib/numberToWords'
import { COMPANY } from '@/lib/company'
import Image from 'next/image'

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
  subject, client, items, subtotal, taxRate = 0, taxAmount = 0, total, notes, terms,
}: DocumentTemplateProps) {
  const isInvoice = type === 'invoice'
  const docLabel = isInvoice ? 'INVOICE' : 'QUOTATION'

  return (
    <div style={{
      background: 'white',
      width: 794,
      minHeight: 1123,
      margin: '0 auto',
      padding: '44px 52px',
      fontFamily: 'Inter, sans-serif',
      fontSize: 13,
      color: '#1a1a1a',
      boxSizing: 'border-box',
    }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
        {/* Real logo */}
        <img
          src="/logo.jpg"
          alt="MeshMedia"
          style={{ height: 44, width: 'auto', objectFit: 'contain' }}
        />
        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'Cormorant, Georgia, serif', fontWeight: 700,
            fontSize: 54, color: BRAND, lineHeight: 1, letterSpacing: '-1px',
          }}>
            {docLabel}
          </div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 4 }}>#{number}</div>
          {isInvoice && (
            <div style={{ marginTop: 10, textAlign: 'right' }}>
              <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Balance Due</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: BRAND, fontFamily: 'Cormorant, Georgia, serif' }}>
                AED {fmt(total)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ borderTop: `2px solid ${BRAND}`, marginBottom: 28 }} />

      {/* ── Company info + Dates ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: BRAND, marginBottom: 5 }}>{COMPANY.name}</div>
          <div style={{ color: '#555', lineHeight: 1.75, fontSize: 12 }}>
            <div>{COMPANY.address}</div>
            <div>{COMPANY.city}</div>
            <div>{COMPANY.phone}</div>
            <div>{COMPANY.email}</div>
            <div>{COMPANY.website}</div>
          </div>
        </div>

        <div style={{ minWidth: 210, textAlign: 'right' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginLeft: 'auto' }}>
            <tbody>
              <tr>
                <td style={{ color: '#888', paddingBottom: 6, paddingRight: 12 }}>{isInvoice ? 'Invoice Date' : 'Quote Date'}</td>
                <td style={{ fontWeight: 600, paddingBottom: 6 }}>{fmtDate(issueDate)}</td>
              </tr>
              {isInvoice && (
                <tr>
                  <td style={{ color: '#888', paddingBottom: 6, paddingRight: 12 }}>Terms</td>
                  <td style={{ fontWeight: 600, paddingBottom: 6 }}>Due on Receipt</td>
                </tr>
              )}
              {dueOrExpiryDate && (
                <tr>
                  <td style={{ color: '#888', paddingRight: 12 }}>{dueOrExpiryLabel}</td>
                  <td style={{ fontWeight: 600 }}>{fmtDate(dueOrExpiryDate)}</td>
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
        padding: '12px 16px', marginBottom: 28,
      }}>
        <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          {isInvoice ? 'Bill To' : 'Prepared For'}
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: BRAND }}>{client.company_name}</div>
        {client.contact_person && <div style={{ fontSize: 12, color: '#444', marginTop: 2 }}>{client.contact_person}</div>}
        {client.address && <div style={{ fontSize: 12, color: '#555', marginTop: 1 }}>{client.address}</div>}
        {client.email && <div style={{ fontSize: 12, color: '#555' }}>{client.email}</div>}
        {client.phone && <div style={{ fontSize: 12, color: '#555' }}>{client.phone}</div>}
      </div>

      {/* ── Subject ── */}
      {subject && (
        <div style={{ marginBottom: 22, fontSize: 12 }}>
          <span style={{ color: '#999', marginRight: 8, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>Subject:</span>
          <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{subject}</span>
        </div>
      )}

      {/* ── Line items table ── */}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
        <thead>
          <tr style={{ backgroundColor: BRAND }}>
            <th style={{ width: 32, padding: '10px 12px', textAlign: 'left', color: CREAM, fontSize: 11, fontWeight: 600 }}>#</th>
            <th style={{ padding: '10px 12px', textAlign: 'left', color: CREAM, fontSize: 11, fontWeight: 600 }}>Item & Description</th>
            <th style={{ width: 55, padding: '10px 12px', textAlign: 'right', color: CREAM, fontSize: 11, fontWeight: 600 }}>Qty</th>
            <th style={{ width: 90, padding: '10px 12px', textAlign: 'right', color: CREAM, fontSize: 11, fontWeight: 600 }}>Rate</th>
            <th style={{ width: 100, padding: '10px 12px', textAlign: 'right', color: CREAM, fontSize: 11, fontWeight: 600 }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#fafaf9' : 'white', borderBottom: '1px solid #f0ebe6' }}>
              <td style={{ padding: '10px 12px', fontSize: 12, color: '#888' }}>{idx + 1}</td>
              <td style={{ padding: '10px 12px', fontSize: 12 }}>{item.description}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>{item.quantity}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right' }}>{fmt(item.unit_price)}</td>
              <td style={{ padding: '10px 12px', fontSize: 12, textAlign: 'right', fontWeight: 500 }}>{fmt(item.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 24 }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 250 }}>
          <tbody>
            <tr>
              <td style={{ padding: '5px 20px 5px 0', color: '#888', fontSize: 12 }}>Sub Total</td>
              <td style={{ padding: '5px 0', textAlign: 'right', fontSize: 12 }}>AED {fmt(subtotal)}</td>
            </tr>
            {taxRate > 0 && (
              <tr>
                <td style={{ padding: '5px 20px 5px 0', color: '#888', fontSize: 12 }}>VAT ({taxRate}%)</td>
                <td style={{ padding: '5px 0', textAlign: 'right', fontSize: 12 }}>AED {fmt(taxAmount)}</td>
              </tr>
            )}
            <tr style={{ borderTop: `2px solid ${BRAND}` }}>
              <td style={{ padding: '10px 20px 4px 0', fontWeight: 700, fontSize: 15, color: BRAND }}>Total</td>
              <td style={{ padding: '10px 0 4px', textAlign: 'right', fontWeight: 700, fontSize: 15, color: BRAND }}>AED {fmt(total)}</td>
            </tr>
            {isInvoice && (
              <tr>
                <td style={{ padding: '4px 20px 0 0', fontWeight: 600, fontSize: 13 }}>Balance Due</td>
                <td style={{ padding: '4px 0 0', textAlign: 'right', fontWeight: 600, fontSize: 13 }}>AED {fmt(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Amount in words ── */}
      <div style={{
        backgroundColor: '#faf8f5', border: `1px solid ${CREAM}`,
        borderRadius: 5, padding: '9px 14px', marginBottom: 24, fontSize: 12,
      }}>
        <span style={{ color: '#888', marginRight: 8 }}>Total In Words:</span>
        <span style={{ fontWeight: 600, fontStyle: 'italic', color: BRAND }}>{amountToWords(total)}</span>
      </div>

      {/* ── Bank details (invoices only, single-line layout) ── */}
      {isInvoice && (
        <div style={{ borderTop: '1px solid #ece7e0', paddingTop: 18, marginBottom: 24 }}>
          <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            Payment Details
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.85, color: '#333' }}>
            <div><span style={{ color: '#888', display: 'inline-block', width: 130 }}>Account Name</span><span style={{ fontWeight: 500 }}>{COMPANY.account_name}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 130 }}>Account Number</span><span style={{ fontWeight: 500 }}>{COMPANY.account_number}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 130 }}>IBAN</span><span style={{ fontWeight: 600, letterSpacing: '0.04em' }}>{COMPANY.iban}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 130 }}>Bank</span><span style={{ fontWeight: 500 }}>{COMPANY.bank_name}</span></div>
            <div><span style={{ color: '#888', display: 'inline-block', width: 130 }}>Branch</span><span style={{ fontWeight: 500 }}>{COMPANY.branch}</span></div>
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      {notes && (
        <div style={{ marginBottom: 20, fontSize: 12 }}>
          <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>Notes</div>
          <div style={{ color: '#555', lineHeight: 1.6 }}>{notes}</div>
        </div>
      )}

      {/* ── Terms & Conditions ── */}
      {terms && (
        <div style={{ marginBottom: 28, fontSize: 11 }}>
          <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Terms & Conditions</div>
          <div style={{ color: '#666', lineHeight: 1.7, whiteSpace: 'pre-line' }}>{terms}</div>
        </div>
      )}

      {/* ── Signature ── */}
      <div style={{ marginTop: 36, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <img
          src="/signature.png"
          alt="Signature"
          style={{ height: 64, width: 'auto', objectFit: 'contain', marginBottom: 4, display: 'block' }}
        />
        <div style={{ borderTop: '1px solid #bbb', width: 200, paddingTop: 6 }}>
          <div style={{ fontWeight: 600, fontSize: 12, color: '#1a1a1a' }}>{COMPANY.signatory}</div>
          <div style={{ fontSize: 11, color: '#888' }}>Authorized Signature</div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        marginTop: 32, borderTop: '1px solid #ece7e0', paddingTop: 12,
        display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb',
      }}>
        <span>{COMPANY.name} · TL# {COMPANY.trade_license}</span>
        <span>{COMPANY.email} · {COMPANY.website}</span>
      </div>
    </div>
  )
}
