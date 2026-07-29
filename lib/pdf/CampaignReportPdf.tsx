import React from 'react'
import { Document, Page, View, Text, Image, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer'
import { COMPANY } from '@/lib/company'

const BRAND = '#6E1318', SAND = '#C8BCA8', INK = '#151312', MUTED = '#766f66', PALE = '#F7F3ED'
const money = (n = 0) => `AED ${Number(n).toLocaleString('en-AE', { maximumFractionDigits: 2 })}`
const num = (n = 0) => Number(n).toLocaleString('en-AE', { maximumFractionDigits: 1 })
const pct = (n = 0) => `${Number(n).toFixed(2)}%`
const st = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 42, paddingHorizontal: 38, fontFamily: 'Helvetica', fontSize: 8.5, color: INK },
  row: { flexDirection: 'row' }, between: { flexDirection: 'row', justifyContent: 'space-between' },
  title: { fontFamily: 'Times-Bold', fontSize: 27, color: BRAND }, h2: { fontFamily: 'Times-Bold', fontSize: 17, color: BRAND, marginBottom: 9 },
  h3: { fontFamily: 'Helvetica-Bold', fontSize: 10, color: BRAND }, muted: { color: MUTED },
  rule: { borderTopWidth: 2, borderTopColor: BRAND, marginVertical: 12 },
  card: { flex: 1, backgroundColor: PALE, borderLeftWidth: 3, borderLeftColor: BRAND, padding: 9, marginRight: 7 },
  label: { fontSize: 6.5, color: MUTED, textTransform: 'uppercase', letterSpacing: 0.7 }, value: { fontFamily: 'Helvetica-Bold', fontSize: 13, marginTop: 3 },
  tableHead: { flexDirection: 'row', backgroundColor: BRAND, color: '#fff', paddingVertical: 6, paddingHorizontal: 5 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#ded8ce', paddingVertical: 6, paddingHorizontal: 5 },
  footer: { position: 'absolute', bottom: 15, left: 38, right: 38, borderTopWidth: 0.5, borderTopColor: SAND, paddingTop: 5, flexDirection: 'row', justifyContent: 'space-between', fontSize: 6.5, color: MUTED },
})

type Props = { clientName: string; projectName?: string; start: string; end: string; timezone: string; commentary?: string; summary?: any; language?: 'en'|'ar'|'bilingual'; data: any; baseUrl: string }
const Footer = () => <View fixed style={st.footer}><Text>{COMPANY.name} · {COMPANY.city}</Text><Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} /><Text>{COMPANY.website}</Text></View>

function MetricCard({ label, value, delta }: { label: string; value: string; delta?: number | null }) {
  return <View style={st.card}><Text style={st.label}>{label}</Text><Text style={st.value}>{value}</Text>{delta != null && <Text style={{ fontSize: 6.5, color: delta >= 0 ? '#237a43' : BRAND, marginTop: 2 }}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}% vs prior</Text>}</View>
}

function CampaignReport({ clientName, projectName, start, end, timezone, commentary, summary, language, data, baseUrl }: Props) {
  const t = data.totals ?? {}, changes = data.comparison?.changes ?? {}
  const pageStyle = language === 'ar' || language === 'bilingual' ? [st.page, { fontFamily:'NotoArabic' }] : st.page
  return <Document title={`${clientName} Campaign Performance Report`} author={COMPANY.name}>
    <Page size="A4" style={pageStyle}>
      <View style={[st.between, { alignItems: 'flex-start' }]}><Image src={`${baseUrl}/logo.jpg`} style={{ width: 125, height: 52, objectFit: 'contain' }} /><View style={{ alignItems: 'flex-end', maxWidth: 320 }}><Text style={st.title}>CAMPAIGN REPORT</Text><Text style={[st.muted, { marginTop: 3 }]}>{start} — {end}</Text></View></View>
      <View style={st.rule}/>
      <View style={[st.between, { marginBottom: 18 }]}><View><Text style={st.label}>Prepared for</Text><Text style={[st.h3, { fontSize: 14, marginTop: 3 }]}>{clientName}</Text>{projectName && <Text style={[st.muted, { marginTop: 2 }]}>{projectName}</Text>}</View><View style={{ alignItems: 'flex-end' }}><Text style={st.label}>Reporting timezone</Text><Text style={{ marginTop: 3 }}>{timezone}</Text><Text style={[st.muted, { marginTop: 2 }]}>Generated {new Date().toLocaleDateString('en-AE')}</Text></View></View>
      <Text style={st.h2}>Executive performance</Text>
      <View style={[st.row, { marginBottom: 8 }]}><MetricCard label="Media spend" value={money(t.spend)} delta={changes.spend}/><MetricCard label="Impressions" value={num(t.impressions)} delta={changes.impressions}/><MetricCard label="Clicks" value={num(t.clicks)} delta={changes.clicks}/><MetricCard label="CTR" value={pct(t.ctr)} delta={changes.ctr}/></View>
      <View style={[st.row, { marginBottom: 18 }]}><MetricCard label="Conversions" value={num(t.conversions)} delta={changes.conversions}/><MetricCard label="Cost / result" value={money(t.cpa)} delta={changes.cpa}/><MetricCard label="Conversion rate" value={pct(t.conversionRate)} delta={changes.conversionRate}/><MetricCard label="ROAS" value={`${Number(t.roas || 0).toFixed(2)}×`} delta={changes.roas}/></View>
      <Text style={st.h2}>Agency analysis</Text>
      <View style={{ backgroundColor: PALE, padding: 12, borderLeftWidth: 3, borderLeftColor: SAND, minHeight: 72 }}><Text style={{ lineHeight: 1.45 }}>{commentary?.trim() || summary?.summary || 'Performance commentary was not added for this report.'}</Text></View>
      {summary?.clientHeadline&&<View style={{marginTop:10,padding:9,borderWidth:.5,borderColor:SAND}}><Text style={st.label}>Client takeaway</Text><Text style={{marginTop:3,fontFamily:language==='ar'||language==='bilingual'?'NotoArabic':'Helvetica-Bold'}}>{summary.clientHeadline}</Text></View>}
      <Text style={[st.h2, { marginTop: 20 }]}>Platform distribution</Text>
      {(data.byProvider ?? []).map((p: any) => <View key={p.provider} style={[st.between, { paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#ded8ce' }]}><Text style={{ width: '25%', fontFamily: 'Helvetica-Bold' }}>{String(p.provider).replace('_ads',' Ads').replace('google','Google').replace('meta','Meta')}</Text><Text style={{ width: '20%' }}>{money(p.spend)}</Text><Text style={{ width: '20%' }}>{num(p.impressions)} imp.</Text><Text style={{ width: '15%' }}>{pct(p.ctr)} CTR</Text><Text style={{ width: '20%', textAlign: 'right' }}>{num(p.conversions)} results</Text></View>)}
      <Footer/>
    </Page>
    {(summary?.recommendations?.length||data.alerts?.length||data.pacing)&&<Page size="A4" style={pageStyle}><Text style={st.h2}>Insights & next actions</Text>{data.pacing&&<View style={{backgroundColor:PALE,padding:12,marginBottom:16}}><Text style={st.h3}>Budget pacing</Text><Text style={{marginTop:5}}>Budget {money(data.pacing.budget)} · Spent {money(data.pacing.spent)} · Forecast {money(data.pacing.forecastSpend)}</Text><Text style={[st.muted,{marginTop:3}]}>{Math.abs(data.pacing.variance).toFixed(1)}% {data.pacing.variance>=0?'ahead of':'behind'} planned pace</Text></View>}<Text style={st.h3}>Automated attention points</Text>{(data.alerts??[]).map((a:any,i:number)=><View key={i} style={{marginTop:7,padding:9,borderLeftWidth:3,borderLeftColor:a.severity==='high'?BRAND:SAND,backgroundColor:PALE}}><Text style={{fontFamily:'Helvetica-Bold'}}>{a.title}</Text><Text style={[st.muted,{marginTop:3}]}>{a.message}</Text></View>)}{summary?.recommendations?.length>0&&<><Text style={[st.h3,{marginTop:20}]}>Recommended actions</Text>{summary.recommendations.map((r:string,i:number)=><View key={i} style={{flexDirection:'row',marginTop:8}}><Text style={{color:BRAND,width:18,fontFamily:'Helvetica-Bold'}}>{i+1}.</Text><Text style={{flex:1,lineHeight:1.4}}>{r}</Text></View>)}</>}<View style={{marginTop:20,backgroundColor:PALE,padding:12}}><Text style={st.h3}>CRM context</Text><Text style={{marginTop:5}}>Qualified CRM leads: {data.crm?.qualifiedLeads??0} · Won leads: {data.crm?.wonLeads??0} · Pipeline value: {money(data.crm?.pipelineValue??0)}</Text><Text style={[st.muted,{marginTop:3}]}>Platform conversions and qualified CRM outcomes are shown separately to avoid overstating business results.</Text></View>{language==='bilingual'&&<Text style={[st.muted,{marginTop:16}]}>Bilingual report selected. Arabic executive text is included when supplied by the AI analysis.</Text>}<Footer/></Page>}
    <Page size="A4" style={pageStyle}>
      <Text style={st.h2}>Campaign breakdown</Text><Text style={[st.muted, { marginBottom: 10 }]}>Detailed delivery, efficiency, and outcome metrics for every campaign in the selected period.</Text>
      <View style={st.tableHead}><Text style={{ width: '27%' }}>Campaign</Text><Text style={{ width: '13%' }}>Spend</Text><Text style={{ width: '13%' }}>Impr.</Text><Text style={{ width: '10%' }}>Clicks</Text><Text style={{ width: '9%' }}>CTR</Text><Text style={{ width: '12%' }}>Conv.</Text><Text style={{ width: '9%' }}>CPA</Text><Text style={{ width: '7%' }}>ROAS</Text></View>
      {(data.campaigns ?? []).map((c: any) => <View key={`${c.provider}-${c.id}`} wrap={false} style={st.tableRow}><Text style={{ width: '27%', paddingRight: 4 }}>{c.name}</Text><Text style={{ width: '13%' }}>{money(c.spend)}</Text><Text style={{ width: '13%' }}>{num(c.impressions)}</Text><Text style={{ width: '10%' }}>{num(c.clicks)}</Text><Text style={{ width: '9%' }}>{pct(c.ctr)}</Text><Text style={{ width: '12%' }}>{num(c.conversions)}</Text><Text style={{ width: '9%' }}>{money(c.cpa).replace('AED ','')}</Text><Text style={{ width: '7%' }}>{c.roas.toFixed(1)}×</Text></View>)}
      <Text style={[st.h2, { marginTop: 20 }]}>Daily trend</Text>
      <View style={st.tableHead}><Text style={{ width: '18%' }}>Date</Text><Text style={{ width: '18%' }}>Spend</Text><Text style={{ width: '18%' }}>Impressions</Text><Text style={{ width: '15%' }}>Clicks</Text><Text style={{ width: '15%' }}>CTR</Text><Text style={{ width: '16%' }}>Conversions</Text></View>
      {(data.days ?? []).map((d: any) => <View key={d.date} wrap={false} style={st.tableRow}><Text style={{ width: '18%' }}>{d.date}</Text><Text style={{ width: '18%' }}>{money(d.spend)}</Text><Text style={{ width: '18%' }}>{num(d.impressions)}</Text><Text style={{ width: '15%' }}>{num(d.clicks)}</Text><Text style={{ width: '15%' }}>{pct(d.ctr)}</Text><Text style={{ width: '16%' }}>{num(d.conversions)}</Text></View>)}
      <Footer/>
    </Page>
    {(data.creatives ?? []).length > 0 && <Page size="A4" style={pageStyle}><Text style={st.h2}>Ads & creative performance</Text><Text style={[st.muted, { marginBottom: 10 }]}>Ad-level results reveal which creative executions and ad groups are driving delivery.</Text><View style={st.tableHead}><Text style={{ width: '28%' }}>Ad / creative</Text><Text style={{ width: '20%' }}>Campaign</Text><Text style={{ width: '13%' }}>Spend</Text><Text style={{ width: '13%' }}>Impr.</Text><Text style={{ width: '10%' }}>CTR</Text><Text style={{ width: '9%' }}>Conv.</Text><Text style={{ width: '7%' }}>ROAS</Text></View>{data.creatives.map((a: any) => <View key={`${a.provider}-${a.id}`} wrap={false} style={st.tableRow}><View style={{ width: '28%', paddingRight: 4 }}><Text>{a.name || `Ad ${a.id}`}</Text><Text style={[st.muted, { fontSize: 6.5, marginTop: 2 }]}>{a.adGroup || a.type}</Text></View><Text style={{ width: '20%', paddingRight: 4 }}>{a.campaign}</Text><Text style={{ width: '13%' }}>{money(a.spend)}</Text><Text style={{ width: '13%' }}>{num(a.impressions)}</Text><Text style={{ width: '10%' }}>{pct(a.ctr)}</Text><Text style={{ width: '9%' }}>{num(a.conversions)}</Text><Text style={{ width: '7%' }}>{a.roas.toFixed(1)}×</Text></View>)}<Footer/></Page>}
    <Page size="A4" style={pageStyle}><Text style={st.h2}>Metric guide & methodology</Text>{[['Impressions','The number of times an ad was served.'],['Clicks','Platform-reported clicks on the ad.'],['CTR','Clicks divided by impressions.'],['CPC','Spend divided by clicks.'],['CPM','Spend per 1,000 impressions.'],['Conversions','Conversion actions configured in the advertising account.'],['CPA','Spend divided by conversions.'],['ROAS','Platform-attributed conversion value divided by spend.']].map(([a,b])=><View key={a} style={{ marginBottom: 10 }}><Text style={st.h3}>{a}</Text><Text style={[st.muted,{ marginTop: 2 }]}>{b}</Text></View>)}<View style={{ marginTop: 16, padding: 10, backgroundColor: PALE }}><Text style={st.h3}>Attribution note</Text><Text style={[st.muted,{ marginTop: 4, lineHeight: 1.4 }]}>Results are sourced from connected advertising platforms and follow each account’s configured attribution settings. Platform totals can differ from analytics or CRM totals because of attribution windows, consent, modelling, time zones, and late conversion updates.</Text></View><Footer/></Page>
  </Document>
}

export const renderCampaignReportPdf = (props: Props) => {
  if (props.language === 'ar' || props.language === 'bilingual') Font.register({ family:'NotoArabic', src:`${props.baseUrl}/fonts/NotoSansArabic.ttf` })
  return renderToBuffer(<CampaignReport {...props}/>)
}
