'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Printer, Download, ArrowLeft, Loader2 } from 'lucide-react'
import { COMPANY } from '@/lib/company'
import { waitForImages } from '@/lib/waitForImages'

const BRAND = '#6E1318'
const CREAM = '#F3EEE6'

function monthLabel(period: string) {
  return new Date(`${period}-01T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
}
function fmtDate(s?: string | null) {
  if (!s) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(s))
}

export default function PayslipPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [payment, setPayment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [preparingPrint, setPreparingPrint] = useState(false)

  const printNow = async () => {
    setPreparingPrint(true)
    await waitForImages()
    setPreparingPrint(false)
    window.print()
  }

  useEffect(() => {
    fetch(`/api/payslip/${id}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d })
      .then(d => { setPayment(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [id])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'Inter, sans-serif' }}>
      Loading payslip…
    </div>
  )
  if (error || !payment) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888', fontFamily: 'Inter, sans-serif' }}>
      {error || 'Payslip not found'}
    </div>
  )

  const btnStyle = (bg: string, color: string): React.CSSProperties => ({
    background: bg, border: 'none', color,
    padding: '7px 14px', borderRadius: 6, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
    textDecoration: 'none', whiteSpace: 'nowrap',
  })

  return (
    <>
      <div className="no-print" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: BRAND, padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button onClick={() => window.history.back()} style={btnStyle('rgba(255,255,255,0.15)', 'white')}>
          <ArrowLeft size={13} /> Back
        </button>
        <span style={{ color: 'rgba(255,255,255,0.5)', margin: '0 4px' }}>|</span>
        <span style={{ color: 'white', fontWeight: 600, fontSize: 13, flex: 1 }}>
          Payslip · {monthLabel(payment.period)}
        </span>
        <button onClick={printNow} disabled={preparingPrint} style={btnStyle('rgba(255,255,255,0.2)', 'white')}>
          {preparingPrint ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Print
        </button>
        <button onClick={printNow} disabled={preparingPrint} style={btnStyle('white', BRAND)}>
          {preparingPrint ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />} Download PDF
        </button>
      </div>

      <div className="print-page-wrap" style={{ paddingTop: 60, background: '#f0ede8', minHeight: '100vh' }}>
        <div style={{ paddingBottom: 40 }}>
          <div style={{
            background: 'white', width: 794, minHeight: 400, margin: '0 auto',
            padding: '36px 50px', fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#1a1a1a', boxSizing: 'border-box',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
              <img src="/logo.jpg" alt="MeshMedia" style={{ height: 60, width: 'auto', objectFit: 'contain' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Cormorant, Georgia, serif', fontWeight: 700, fontSize: 34, color: BRAND, lineHeight: 1 }}>PAYSLIP</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{monthLabel(payment.period)}</div>
              </div>
            </div>

            <div style={{ borderTop: `2px solid ${BRAND}`, marginBottom: 20 }} />

            <div style={{ fontWeight: 700, fontSize: 13, color: BRAND, marginBottom: 4 }}>{COMPANY.name}</div>
            <div style={{ color: '#555', lineHeight: 1.5, fontSize: 11.5, marginBottom: 20 }}>
              <div>{COMPANY.address}, {COMPANY.city}</div>
              <div>{COMPANY.email} · {COMPANY.phone}</div>
            </div>

            <div style={{
              backgroundColor: '#faf8f5', border: `1px solid ${CREAM}`, borderLeft: `4px solid ${BRAND}`,
              borderRadius: 4, padding: '12px 16px', marginBottom: 20,
            }}>
              <div style={{ fontSize: 9.5, color: '#999', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Paid To</div>
              <div style={{ fontWeight: 700, fontSize: 15, color: BRAND }}>{payment.profile?.full_name ?? 'Team Member'}</div>
              {payment.profile?.email && <div style={{ fontSize: 11.5, color: '#555' }}>{payment.profile.email}</div>}
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f0ebe6' }}>
                  <td style={{ padding: '8px 0', color: '#888', fontSize: 12 }}>Pay Period</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, fontSize: 12, textTransform: 'capitalize' }}>{payment.salary?.pay_period ?? 'Monthly'}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f0ebe6' }}>
                  <td style={{ padding: '8px 0', color: '#888', fontSize: 12 }}>Payment Date</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontWeight: 600, fontSize: 12 }}>{fmtDate(payment.payment_date)}</td>
                </tr>
                {payment.notes && (
                  <tr style={{ borderBottom: '1px solid #f0ebe6' }}>
                    <td style={{ padding: '8px 0', color: '#888', fontSize: 12 }}>Notes</td>
                    <td style={{ padding: '8px 0', textAlign: 'right', fontSize: 12 }}>{payment.notes}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: BRAND, borderRadius: 6, padding: '16px 20px', marginBottom: 24,
            }}>
              <span style={{ color: CREAM, fontSize: 13, fontWeight: 600 }}>Net Pay</span>
              <span style={{ color: 'white', fontSize: 24, fontWeight: 700, fontFamily: 'Cormorant, Georgia, serif' }}>
                {payment.salary?.currency ?? 'AED'} {Number(payment.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{
              marginTop: 30, borderTop: '1px solid #ece7e0', paddingTop: 12,
              display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#bbb',
            }}>
              <span>{COMPANY.name} · TL# {COMPANY.trade_license}</span>
              <span>Generated by Mesh Media Agency OS</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
