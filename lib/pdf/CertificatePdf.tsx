import React from 'react'
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { COMPANY } from '@/lib/company'

const BRAND = '#6E1318'
const CREAM = '#F3EEE6'

export interface CertificateRecipient {
  name: string
  email: string
  role: string
  signed_at: string
  ip_address: string | null
  fields: { field_type: string }[]
}

export interface CertificatePdfProps {
  title: string
  documentId: string
  completedAt: string
  sha256: string
  recipients: CertificateRecipient[]
}

const fmtDateTime = (s: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(s))

const st = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 40, paddingHorizontal: 44, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a1a' },
  header: { borderBottomWidth: 2, borderBottomColor: BRAND, paddingBottom: 14, marginBottom: 20 },
  h1: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: BRAND, marginBottom: 3 },
  muted: { color: '#666', fontSize: 9 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  recipientBox: {
    backgroundColor: '#faf8f5', borderWidth: 1, borderColor: CREAM, borderLeftWidth: 3, borderLeftColor: BRAND,
    borderRadius: 3, padding: 10, marginBottom: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  label: { fontSize: 7.5, color: '#999', textTransform: 'uppercase', letterSpacing: 0.4 },
  bold: { fontFamily: 'Helvetica-Bold' },
  hashBox: { backgroundColor: '#f2f2f2', borderRadius: 3, padding: 8, fontSize: 8, fontFamily: 'Courier' },
  footer: { position: 'absolute', bottom: 24, left: 44, right: 44, fontSize: 7.5, color: '#999', textAlign: 'center', borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 8 },
})

export function CertificatePdfDoc({ title, documentId, completedAt, sha256, recipients }: CertificatePdfProps) {
  return (
    <Document>
      <Page size="A4" style={st.page}>
        <View style={st.header}>
          <Text style={st.h1}>Certificate of Completion</Text>
          <Text style={st.muted}>{COMPANY.name} · Electronic Signature Record</Text>
        </View>

        <View style={st.section}>
          <Text style={st.sectionTitle}>Document</Text>
          <Text style={st.bold}>{title}</Text>
          <Text style={st.muted}>Reference ID: {documentId}</Text>
          <Text style={st.muted}>Completed: {fmtDateTime(completedAt)}</Text>
        </View>

        <View style={st.section}>
          <Text style={st.sectionTitle}>Signers ({recipients.length})</Text>
          {recipients.map((r, i) => (
            <View key={i} style={st.recipientBox}>
              <View style={st.row}>
                <Text style={st.bold}>{r.name}</Text>
                <Text style={st.muted}>{r.role}</Text>
              </View>
              <Text style={st.muted}>{r.email}</Text>
              <View style={{ marginTop: 4 }}>
                <Text style={st.label}>Signed</Text>
                <Text>{fmtDateTime(r.signed_at)}</Text>
              </View>
              <View style={{ marginTop: 4 }}>
                <Text style={st.label}>IP address</Text>
                <Text>{r.ip_address ?? 'Not recorded'}</Text>
              </View>
              <View style={{ marginTop: 4 }}>
                <Text style={st.label}>Fields completed</Text>
                <Text>{r.fields.map((f) => f.field_type).join(', ')}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={st.section}>
          <Text style={st.sectionTitle}>Document Integrity</Text>
          <Text style={{ marginBottom: 4, fontSize: 8.5 }}>
            SHA-256 hash of the final signed PDF — any alteration to the document after
            completion will produce a different hash, proving the file has been tampered with.
          </Text>
          <View style={st.hashBox}><Text>{sha256}</Text></View>
        </View>

        <View style={st.footer}>
          <Text>
            This certificate was generated automatically by {COMPANY.name}&apos;s Agency OS at the moment every
            party completed their signature, and is bound to the document referenced above. Each signature
            was captured with the signer&apos;s name, a personal single-use signing link, IP address, and a
            timestamp — together forming the audit trail for this electronic signature.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderCertificatePdf(props: CertificatePdfProps): Promise<Buffer> {
  return renderToBuffer(<CertificatePdfDoc {...props} />)
}
