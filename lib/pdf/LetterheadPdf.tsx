import React from 'react'
import fs from 'fs'
import path from 'path'
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import type { AgencyDocumentData, DocumentBlock } from '@/lib/letterhead/types'

const MAROON = '#6E1318'
const SAND = '#C8BCA8'
const TAUPE = '#9C9384'
const INK = '#151312'

const imageData = (name: string) => {
  const file = fs.readFileSync(path.join(process.cwd(), 'lib', 'letterhead', 'assets', name))
  return `data:image/png;base64,${file.toString('base64')}`
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 125,
    paddingBottom: 78,
    paddingLeft: 85,
    paddingRight: 62,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    lineHeight: 1.52,
    color: INK,
  },
  firstHeader: { position: 'absolute', top: 36, left: 85, right: 62, height: 74 },
  continuationHeader: { position: 'absolute', top: 38, left: 85, right: 62, height: 32 },
  footer: { position: 'absolute', left: 85, right: 62, bottom: 30, borderTopWidth: 0.6, borderTopColor: SAND, paddingTop: 8 },
  micro: { fontSize: 6.2, letterSpacing: 1.1, color: TAUPE },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  paragraph: { marginBottom: 8 },
  heading: { marginTop: 7, marginBottom: 5, color: MAROON, fontFamily: 'Helvetica-Bold', fontSize: 13 },
  recipient: { marginBottom: 1, color: '#6E655B' },
  subject: { marginTop: 15, marginBottom: 15, color: MAROON, fontFamily: 'Helvetica-Bold', fontSize: 8.5, letterSpacing: 1 },
})

function FirstHeader() {
  return (
    <View style={styles.firstHeader}>
      <View style={styles.row}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={imageData('logo_lockup.png')} style={{ width: 148, height: 42, objectFit: 'contain' }} />
        <View />
      </View>
      <View style={{ flexDirection: 'row', marginTop: 13, alignItems: 'center' }}>
        <View style={{ width: 92, height: 4, backgroundColor: MAROON }} />
        <View style={{ flex: 1, height: 0.6, backgroundColor: SAND, marginLeft: 8 }} />
      </View>
    </View>
  )
}

function ContinuationHeader() {
  return (
    <View style={styles.continuationHeader}>
      <View style={styles.row}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={imageData('mark_small.png')} style={{ width: 16, height: 18, objectFit: 'contain' }} />
        </View>
        <View />
      </View>
      <View style={{ height: 0.6, backgroundColor: SAND, marginTop: 7 }} />
    </View>
  )
}

function Footer() {
  return (
    <View fixed style={styles.footer}>
      <View style={styles.row}>
        <Text style={styles.micro}>MAZYAD MALL, TOWER 2, OFFICE 619</Text>
        <Text style={styles.micro}>+971 50 950 1326</Text>
        <Text style={styles.micro}>THEMESHMEDIA.COM</Text>
      </View>
      <View style={[styles.row, { marginTop: 2 }]}>
        <Text style={styles.micro}>MBZ · ABU DHABI · U.A.E.</Text>
        <Text style={styles.micro}>HELLO@M3M.AE</Text>
        <Text style={styles.micro}>TRADE LICENCE 1594410</Text>
      </View>
    </View>
  )
}

function Block({ block, number }: { block: DocumentBlock; number: number }) {
  const common = {
    fontFamily: block.bold && block.italic ? 'Helvetica-BoldOblique' : block.bold ? 'Helvetica-Bold' : block.italic ? 'Helvetica-Oblique' : 'Helvetica',
    textAlign: block.align ?? 'left' as const,
  }
  if (block.type === 'heading') return <Text style={[styles.heading, common]}>{block.text}</Text>
  if (block.type === 'bullet') return <Text style={[styles.paragraph, common, { paddingLeft: 12 }]}>•  {block.text}</Text>
  if (block.type === 'numbered') return <Text style={[styles.paragraph, common, { paddingLeft: 12 }]}>{number}.  {block.text}</Text>
  return <Text style={[styles.paragraph, common]}>{block.text}</Text>
}

function LetterheadDocument({ data }: { data: AgencyDocumentData }) {
  let numbered = 0
  return (
    <Document title={data.title} author="MeshMedia For Marketing and PR">
      <Page size="A4" style={styles.page} wrap>
        <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 125 }} render={({ pageNumber }) => pageNumber === 1 ? <FirstHeader /> : <ContinuationHeader />} />
        <Text fixed style={[styles.micro, { position: 'absolute', top: 48, right: 62, color: MAROON, fontFamily: 'Helvetica-Bold' }]} render={({ pageNumber }) => pageNumber === 1 ? 'MARKETING & PUBLIC RELATIONS' : ''} />
        <Text fixed style={[styles.micro, { position: 'absolute', top: 60, right: 62 }]} render={({ pageNumber }) => pageNumber === 1 ? 'ABU DHABI  ·  UNITED ARAB EMIRATES' : ''} />
        <Text fixed style={[styles.micro, { position: 'absolute', top: 48, left: 108, color: MAROON, fontFamily: 'Helvetica-Bold' }]} render={({ pageNumber }) => pageNumber > 1 ? 'MESHMEDIA' : ''} />
        <Text fixed style={[styles.micro, { position: 'absolute', top: 48, right: 62 }]} render={({ pageNumber }) => pageNumber > 1 ? `PAGE ${pageNumber}` : ''} />
        <View fixed style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} render={({ pageNumber }) => pageNumber === 1 ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={imageData('ghost_mark.png')} style={{ position: 'absolute', width: 370, height: 405, left: 210, top: 385, opacity: 0.035 }} />
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={imageData('edge_type.png')} style={{ position: 'absolute', width: 11, height: 94, left: 35, top: 480, opacity: 0.75 }} />
          </>
        ) : null} />
        <Footer />

        <Text style={[styles.micro, { marginBottom: 22 }]}>
          {new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date())}
        </Text>
        {data.recipient_name ? <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 1 }}>{data.recipient_name}</Text> : null}
        {data.recipient_title ? <Text style={styles.recipient}>{data.recipient_title}</Text> : null}
        {data.company_name ? <Text style={styles.recipient}>{data.company_name}</Text> : null}
        {data.address_line ? <Text style={styles.recipient}>{data.address_line}</Text> : null}
        <Text style={styles.subject}>SUBJECT:  {data.subject.toUpperCase()}</Text>
        <Text style={[styles.paragraph, { marginBottom: 12 }]}>Dear {data.salutation_name || data.recipient_name || 'Sir/Madam'},</Text>

        {(data.content ?? []).map((block) => {
          if (block.type === 'numbered') numbered += 1
          else numbered = 0
          return block.text.trim() ? <Block key={block.id} block={block} number={numbered} /> : null
        })}

        <Text style={{ marginTop: 10 }}>{data.closing || 'Warm regards,'}</Text>
        <View style={{ marginTop: 42, width: 166, borderTopWidth: 1, borderTopColor: MAROON, paddingTop: 8 }} wrap={false}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11 }}>{data.signatory_name}</Text>
          <Text style={[styles.micro, { marginTop: 2 }]}>{data.signatory_role}</Text>
        </View>
      </Page>
    </Document>
  )
}

export async function renderLetterheadPdf(data: AgencyDocumentData): Promise<Buffer> {
  return renderToBuffer(<LetterheadDocument data={data} />)
}
