'use client'

export default function RevenueChart({ data }: { data: { label: string; revenue: number; expenses: number }[] }) {
  const width = 600
  const height = 220
  const padding = { top: 10, right: 10, bottom: 24, left: 10 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const max = Math.max(1, ...data.map(d => Math.max(d.revenue, d.expenses)))
  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0

  const points = (key: 'revenue' | 'expenses') =>
    data.map((d, i) => {
      const x = padding.left + i * stepX
      const y = padding.top + innerH - (d[key] / max) * innerH
      return `${x},${y}`
    }).join(' ')

  const hasData = data.some(d => d.revenue > 0 || d.expenses > 0)

  return (
    <div>
      <div className="flex items-center gap-4 mb-2 text-xs">
        <span className="flex items-center gap-1.5 text-taupe-600"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--success)' }} />Revenue</span>
        <span className="flex items-center gap-1.5 text-taupe-600"><span className="w-2 h-2 rounded-full inline-block" style={{ background: 'var(--danger)' }} />Expenses</span>
      </div>
      {hasData ? (
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
          <polyline fill="none" stroke="var(--success)" strokeWidth="2.5" points={points('revenue')} strokeLinejoin="round" strokeLinecap="round" />
          <polyline fill="none" stroke="var(--danger)" strokeWidth="2.5" points={points('expenses')} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => {
            const x = padding.left + i * stepX
            return (
              <g key={d.label}>
                <circle cx={x} cy={padding.top + innerH - (d.revenue / max) * innerH} r="3" fill="var(--success)" />
                <circle cx={x} cy={padding.top + innerH - (d.expenses / max) * innerH} r="3" fill="var(--danger)" />
                <text x={x} y={height - 4} textAnchor="middle" fontSize="10" fill="var(--text-muted, #6E655B)">{d.label}</text>
              </g>
            )
          })}
        </svg>
      ) : (
        <div className="h-[180px] flex items-center justify-center text-sm text-taupe-500">No revenue data yet</div>
      )}
    </div>
  )
}
