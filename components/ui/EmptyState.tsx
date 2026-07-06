import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export default function EmptyState({
  icon: Icon, title, helper, action, colSpan,
}: {
  icon?: LucideIcon
  title: string
  helper?: string
  action?: ReactNode
  colSpan?: number
}) {
  const content = (
    <div className="px-5 py-16 text-center flex flex-col items-center">
      {Icon && (
        <div className="w-10 h-10 rounded-full bg-paper-100 flex items-center justify-center mb-3">
          <Icon className="w-5 h-5 text-taupe-500" />
        </div>
      )}
      <h3 className="font-display text-xl text-ink">{title}</h3>
      {helper && <p className="text-sm text-taupe-500 mt-1 max-w-xs">{helper}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )

  if (colSpan) {
    return (
      <tr>
        <td colSpan={colSpan}>{content}</td>
      </tr>
    )
  }

  return content
}
