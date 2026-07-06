'use client'

import { formatCurrency } from '@/lib/utils'

const COLORS = ['#6E1318', '#D98A8E', '#B8801F', '#4A5A6E', '#4F7A4A', '#9C9384']

export default function ExpenseDonut({ data }: { data: { label: string; amount: number }[] }) {
  const total = data.reduce((s, d) => s + d.amount, 0)
  const size = 160
  const r = 60
  const cx = size / 2
  const cy = size / 2
  const circumference = 2 * Math.PI * r

  let offset = 0
  const segments = total > 0 ? data.map((d, i) => {
    const fraction = d.amount / total
    const dash = fraction * circumference
    const seg = { ...d, color: COLORS[i % COLORS.length], dasharray: `${dash} ${circumference - dash}`, dashoffset: -offset }
    offset += dash
    return seg
  }) : []

  return (
    <div className="flex items-center gap-6 flex-wrap">
      {total > 0 ? (
        <>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {segments.map((s) => (
                <circle
                  key={s.label}
                  cx={cx} cy={cy} r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="20"
                  strokeDasharray={s.dasharray}
                  strokeDashoffset={s.dashoffset}
                />
              ))}
            </g>
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--ink, #151312)">{formatCurrency(total)}</text>
            <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fill="var(--text-muted, #6E655B)">Total</text>
          </svg>
          <div className="flex-1 min-w-[140px] space-y-1.5">
            {segments.map((s) => (
              <div key={s.label} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-taupe-600 truncate">
                  <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-medium text-ink flex-shrink-0 ml-2">{formatCurrency(s.amount)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="h-[160px] w-full flex items-center justify-center text-sm text-taupe-500">No expenses yet</div>
      )}
    </div>
  )
}
