import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { COMPANY } from '@/lib/company'
import type { ClientReportStats } from '@/lib/impactReport'

// Server-side PDF twin of DocumentPdf.tsx, reusing the same brand tokens
// and layout conventions so it looks like it belongs next to the invoices
// and quotations clients already receive.

const BRAND = '#6E1318'
const CREAM = '#F3EEE6'

export interface ImpactReportPdfProps {
  clientName: string
  period: string // 'YYYY-MM'
  stats: ClientReportStats
  /** Absolute origin used to fetch /logo.jpg */
  baseUrl: string
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

const monthLabel = (period: string) =>
  new Date(`${period}-01T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

const st = StyleSheet.create({
  page: { paddingTop: 26, paddingBottom: 30, paddingHorizontal: 40, fontSize: 9.5, fontFamily: 'Helvetica', color: '#1a1a1a' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 7, color: '#999', textTransform: 'uppercase', letterSpacing: 0.6 },
  muted: { color: '#555' },
  bold: { fontFamily: 'Helvetica-Bold' },
  divider: { borderTopWidth: 2, borderTopColor: BRAND, marginVertical: 12 },
  kpiTile: {
    flex: 1, backgroundColor: '#faf8f5', borderWidth: 1, borderColor: CREAM,
    borderLeftWidth: 4, borderLeftColor: BRAND, borderRadius: 3,
    paddingVertical: 10, paddingHorizontal: 12, marginRight: 8,
  },
})

function Doc(p: ImpactReportPdfProps) {
  const { stats } = p
  return (
    <Document title={`Impact Report — ${p.clientName} — ${monthLabel(p.period)}`} author={COMPANY.name}>
      <Page size="A4" style={st.page}>
        {/* Header */}
        <View style={[st.row, { alignItems: 'flex-start', marginBottom: 6 }]}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={`${p.baseUrl}/logo.jpg`} style={{ height: 54, width: 132, objectFit: 'contain' }} />
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontFamily: 'Times-Bold', fontSize: 30, color: BRAND }}>IMPACT REPORT</Text>
            <Text style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{monthLabel(p.period)}</Text>
          </View>
        </View>

        <View style={st.divider} />

        {/* Client + company */}
        <View style={[st.row, { marginBottom: 16 }]}>
          <View>
            <Text style={[st.bold, { color: BRAND, marginBottom: 3 }]}>{COMPANY.name}</Text>
            <Text style={st.muted}>{COMPANY.address}</Text>
            <Text style={st.muted}>{COMPANY.city}</Text>
            <Text style={st.muted}>{COMPANY.website}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={st.label}>Prepared For</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: BRAND, marginTop: 2 }}>{p.clientName}</Text>
          </View>
        </View>

        {/* KPI tiles */}
        <View style={[st.row, { marginBottom: 18 }]}>
          <View style={st.kpiTile}>
            <Text style={st.label}>Tasks Completed</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: BRAND, marginTop: 4 }}>{stats.tasksCompleted}</Text>
          </View>
          <View style={st.kpiTile}>
            <Text style={st.label}>Hours Logged</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: BRAND, marginTop: 4 }}>{stats.hoursLogged}</Text>
          </View>
          <View style={st.kpiTile}>
            <Text style={st.label}>Revenue</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: BRAND, marginTop: 4 }}>AED {fmt(stats.revenue)}</Text>
          </View>
          <View style={[st.kpiTile, { marginRight: 0 }]}>
            <Text style={st.label}>Deliverables Shipped</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 18, color: BRAND, marginTop: 4 }}>{stats.deliverables.length}</Text>
          </View>
        </View>

        {/* Active projects */}
        <View style={{ marginBottom: 16 }}>
          <Text style={[st.label, { marginBottom: 3 }]}>Active Projects</Text>
          <Text style={st.bold}>{stats.activeProjects}</Text>
        </View>

        {/* Deliverables list */}
        {stats.deliverables.length > 0 ? (
          <View style={{ marginBottom: 16 }}>
            <Text style={[st.label, { marginBottom: 6 }]}>Deliverables</Text>
            {stats.deliverables.map((d, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ color: BRAND, marginRight: 6 }}>•</Text>
                <Text style={{ flex: 1 }}>{d}</Text>
              </View>
            ))}
          </View>
        ) : null}

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

export async function renderImpactReportPdf(props: ImpactReportPdfProps): Promise<Buffer> {
  return renderToBuffer(<Doc {...props} />)
}
