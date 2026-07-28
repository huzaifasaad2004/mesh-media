import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { COMPANY } from '@/lib/company'
import { amountToWords } from '@/lib/numberToWords'

// Server-side PDF twin of components/DocumentTemplate.tsx. This produces a
// real .pdf file (no browser print dialog involved) — the permanent fix for
// "Download PDF opens print preview / saves white pages".

const BRAND = '#6E1318'
const CREAM = '#F3EEE6'

export interface PdfDocProps {
  type: 'invoice' | 'quotation' | 'receipt'
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
  items: { description: string; quantity: number; unit_price: number; amount: number }[]
  subtotal: number
  discountAmount: number
  taxRate: number
  taxAmount: number
  total: number
  status?: string | null
  amountPaid?: number
  paidDate?: string | null
  notes?: string | null
  terms?: string | null
  /** Absolute origin used to fetch /logo.jpg and /signature.png */
  baseUrl: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const fmtDate = (s?: string | null) =>
  s ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s)) : '—'

const st = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 30, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a1a' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 7, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6 },
  muted: { color: '#555' },
  bold: { fontFamily: 'Helvetica-Bold' },
  divider: { borderTopWidth: 2, borderTopColor: BRAND, marginVertical: 12 },
  billBox: {
    backgroundColor: '#faf8f5', borderWidth: 1, borderColor: CREAM,
    borderLeftWidth: 4, borderLeftColor: BRAND, borderRadius: 3,
    paddingVertical: 7, paddingHorizontal: 12, marginBottom: 12,
  },
  th: { color: CREAM, fontSize: 8, fontFamily: 'Helvetica-Bold', paddingVertical: 5, paddingHorizontal: 8 },
  td: { fontSize: 9, paddingVertical: 4.5, paddingHorizontal: 8 },
  right: { textAlign: 'right' },
})

function Doc(p: PdfDocProps) {
  const isInvoice = p.type === 'invoice'
  const isReceipt = p.type === 'receipt'
  const isPaid = (isInvoice && p.status === 'paid') || isReceipt
  const balanceDue = isPaid ? 0 : Math.max(0, p.total - (p.amountPaid ?? 0))
  return (
    <Document title={`${isReceipt ? 'Payment Receipt' : isInvoice ? 'Invoice' : 'Quotation'} ${p.number}`} author={COMPANY.name}>
      <Page size="A4" style={st.page}>
        {/* Header */}
        <View style={[st.row, { alignItems: 'flex-start', marginBottom: 6 }]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={`${p.baseUrl}/logo.jpg`} style={{ height: 54, width: 132, objectFit: 'contain' }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Times-Bold', fontSize: isReceipt ? 25 : 34, color: BRAND }}>
              {isReceipt ? 'PAYMENT RECEIPT' : isInvoice ? 'INVOICE' : 'QUOTATION'}
            </Text>
            <Text style={{ fontSize: 9, color: '#555', marginTop: 2 }}>#{p.number}</Text>
            {(isInvoice || isReceipt) && (
              <View style={{ alignItems: 'flex-end', marginTop: 6 }}>
                <Text style={st.label}>{isReceipt ? 'Amount Received' : 'Balance Due'}</Text>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 14, color: isPaid ? '#238B57' : BRAND }}>AED {fmt(isReceipt ? p.total : balanceDue)}</Text>
              </View>
            )}
          </View>
        </View>

        {isInvoice && isPaid && (
          <View fixed style={{
            position: 'absolute', top: 35, right: -48, width: 190,
            transform: 'rotate(38deg)', backgroundColor: '#238B57',
            paddingVertical: 7, alignItems: 'center', zIndex: 5,
          }}>
            <Text style={{ color: 'white', fontFamily: 'Helvetica-Bold', fontSize: 13, letterSpacing: 2, marginLeft: 24 }}>PAID</Text>
          </View>
        )}

        <View style={st.divider} />

        {/* Company + dates */}
        <View style={[st.row, { marginBottom: 12 }]}>
          <View>
            <Text style={[st.bold, { color: BRAND, marginBottom: 3 }]}>{COMPANY.name}</Text>
            <Text style={st.muted}>{COMPANY.address}</Text>
            <Text style={st.muted}>{COMPANY.city}</Text>
            <Text style={st.muted}>{COMPANY.phone}</Text>
            <Text style={st.muted}>{COMPANY.email}</Text>
            <Text style={st.muted}>{COMPANY.website}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={{ flexDirection: 'row', marginBottom: 3 }}>
              <Text style={{ color: '#888', marginRight: 10 }}>{isReceipt ? 'Payment Date' : isInvoice ? 'Invoice Date' : 'Quote Date'}</Text>
              <Text style={st.bold}>{fmtDate(p.issueDate)}</Text>
            </View>
            {isInvoice && (
              <View style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ color: '#888', marginRight: 10 }}>Terms</Text>
                <Text style={st.bold}>Due on Receipt</Text>
              </View>
            )}
            {p.dueOrExpiryDate && !isReceipt ? (
              <View style={{ flexDirection: 'row' }}>
                <Text style={{ color: '#888', marginRight: 10 }}>{p.dueOrExpiryLabel}</Text>
                <Text style={st.bold}>{fmtDate(p.dueOrExpiryDate)}</Text>
              </View>
            ) : null}
            {isPaid && !isReceipt && p.paidDate ? (
              <View style={{ flexDirection: 'row', marginTop: 3 }}>
                <Text style={{ color: '#238B57', marginRight: 10 }}>Paid Date</Text>
                <Text style={[st.bold, { color: '#238B57' }]}>{fmtDate(p.paidDate)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Bill To */}
        <View style={st.billBox}>
          <Text style={[st.label, { marginBottom: 3 }]}>{isReceipt ? 'Received From' : isInvoice ? 'Bill To' : 'Prepared For'}</Text>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: BRAND }}>{p.client.company_name}</Text>
          {p.client.contact_person ? <Text style={{ color: '#444', marginTop: 1 }}>{p.client.contact_person}</Text> : null}
          {p.client.address ? <Text style={st.muted}>{p.client.address}</Text> : null}
          {p.client.email ? <Text style={st.muted}>{p.client.email}</Text> : null}
          {p.client.phone ? <Text style={st.muted}>{p.client.phone}</Text> : null}
        </View>

        {/* Subject */}
        {p.subject ? (
          <View style={{ flexDirection: 'row', marginBottom: 9, alignItems: 'flex-end' }}>
            <Text style={[st.label, { marginRight: 6 }]}>Subject:</Text>
            <Text style={st.bold}>{p.subject}</Text>
          </View>
        ) : null}

        {/* Items */}
        <View style={{ marginBottom: 9 }}>
          <View style={[st.row, { backgroundColor: BRAND }]}>
            <Text style={[st.th, { width: 24 }]}>#</Text>
            <Text style={[st.th, { flex: 1 }]}>Item & Description</Text>
            <Text style={[st.th, st.right, { width: 40 }]}>Qty</Text>
            <Text style={[st.th, st.right, { width: 70 }]}>Rate</Text>
            <Text style={[st.th, st.right, { width: 80 }]}>Amount</Text>
          </View>
          {p.items.map((it, i) => (
            <View key={i} style={[st.row, { backgroundColor: i % 2 === 0 ? '#fafaf9' : 'white', borderBottomWidth: 1, borderBottomColor: '#f0ebe6' }]}>
              <Text style={[st.td, { width: 24, color: '#888' }]}>{i + 1}</Text>
              <Text style={[st.td, { flex: 1 }]}>{it.description}</Text>
              <Text style={[st.td, st.right, { width: 40 }]}>{it.quantity}</Text>
              <Text style={[st.td, st.right, { width: 70 }]}>{fmt(it.unit_price)}</Text>
              <Text style={[st.td, st.right, { width: 80 }, st.bold]}>{fmt(it.amount)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={{ alignItems: 'flex-end', marginBottom: 9 }}>
          <View style={{ width: 210 }}>
            <View style={[st.row, { marginBottom: 2 }]}>
              <Text style={{ color: '#888' }}>Sub Total</Text>
              <Text>AED {fmt(p.subtotal)}</Text>
            </View>
            {p.discountAmount > 0 && (
              <View style={[st.row, { marginBottom: 2 }]}>
                <Text style={{ color: '#888' }}>Discount</Text>
                <Text style={{ color: '#b23a2e' }}>-AED {fmt(p.discountAmount)}</Text>
              </View>
            )}
            {p.taxRate > 0 && (
              <View style={[st.row, { marginBottom: 2 }]}>
                <Text style={{ color: '#888' }}>VAT ({p.taxRate}%)</Text>
                <Text>AED {fmt(p.taxAmount)}</Text>
              </View>
            )}
            <View style={[st.row, { borderTopWidth: 2, borderTopColor: BRAND, paddingTop: 5, marginTop: 2 }]}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11.5, color: BRAND }}>Total</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11.5, color: BRAND }}>AED {fmt(p.total)}</Text>
            </View>
            {isInvoice && (
              <View style={[st.row, { marginTop: 3 }]}>
                <Text style={st.bold}>Balance Due</Text>
                <Text style={[st.bold, isPaid ? { color: '#238B57' } : {}]}>AED {fmt(balanceDue)}</Text>
              </View>
            )}
            {isReceipt && <View style={[st.row, { marginTop: 3 }]}><Text style={st.bold}>Amount Received</Text><Text style={[st.bold, { color: '#238B57' }]}>AED {fmt(p.total)}</Text></View>}
          </View>
        </View>

        {/* Amount in words */}
        <View style={{ backgroundColor: '#faf8f5', borderWidth: 1, borderColor: CREAM, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 10, marginBottom: 11, flexDirection: 'row' }}>
          <Text style={{ color: '#888', marginRight: 6 }}>Total In Words:</Text>
          <Text style={{ fontFamily: 'Helvetica-BoldOblique', color: BRAND, flex: 1 }}>{amountToWords(p.total)}</Text>
        </View>

        {/* Bank details (invoices) */}
        {isInvoice && !isReceipt && (
          <View style={{ borderTopWidth: 1, borderTopColor: '#ece7e0', paddingTop: 9, marginBottom: 11 }}>
            <Text style={[st.label, { marginBottom: 5 }]}>Payment Details</Text>
            {([
              ['Account Name', COMPANY.account_name],
              ['Account Number', COMPANY.account_number],
              ['IBAN', COMPANY.iban],
              ['Bank', COMPANY.bank_name],
              ['Branch', COMPANY.branch],
            ] as const).map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', marginBottom: 1.5 }}>
                <Text style={{ color: '#888', width: 100 }}>{k}</Text>
                <Text style={st.bold}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Notes */}
        {p.notes ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={[st.label, { marginBottom: 3 }]}>Notes</Text>
            <Text style={{ color: '#555', lineHeight: 1.4 }}>{p.notes}</Text>
          </View>
        ) : null}

        {/* Terms */}
        {p.terms ? (
          <View style={{ marginBottom: 10 }}>
            <Text style={[st.label, { marginBottom: 3 }]}>Terms & Conditions</Text>
            <Text style={{ color: '#666', fontSize: 8, lineHeight: 1.35 }}>{p.terms}</Text>
          </View>
        ) : null}

        {/* Signature */}
        <View style={{ marginTop: 10 }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={`${p.baseUrl}/signature.png`} style={{ height: 40, width: 120, objectFit: 'contain', marginBottom: 2 }} />
          <View style={{ borderTopWidth: 1, borderTopColor: '#bbb', width: 150, paddingTop: 4 }}>
            <Text style={st.bold}>{COMPANY.signatory}</Text>
            <Text style={{ fontSize: 8, color: '#888' }}>Authorized Signature</Text>
          </View>
        </View>

        {/* Footer */}
        <View
          fixed
          style={[st.row, { position: 'absolute', bottom: 14, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#ece7e0', paddingTop: 6 }]}
        >
          <Text style={{ fontSize: 7.5, color: '#bbb' }}>{COMPANY.name} · TL# {COMPANY.trade_license}</Text>
          <Text style={{ fontSize: 7.5, color: '#bbb' }}>{COMPANY.email} · {COMPANY.website}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderDocumentPdf(props: PdfDocProps): Promise<Buffer> {
  return renderToBuffer(<Doc {...props} />)
}
