import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateStr))
}

export function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
  return formatDate(dateStr)
}

export function getInitials(name: string | null | undefined) {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function statusColor(status: string) {
  const map: Record<string, string> = {
    lead:        'bg-yellow-100 text-yellow-800',
    onboarding:  'bg-blue-100 text-blue-800',
    active:      'bg-green-100 text-green-800',
    paused:      'bg-gray-100 text-gray-700',
    churned:     'bg-red-100 text-red-700',
    todo:        'bg-gray-100 text-gray-700',
    in_progress: 'bg-blue-100 text-blue-800',
    review:      'bg-purple-100 text-purple-800',
    done:        'bg-green-100 text-green-800',
    draft:       'bg-gray-100 text-gray-700',
    sent:        'bg-blue-100 text-blue-800',
    signed:      'bg-green-100 text-green-800',
    paid:        'bg-green-100 text-green-800',
    overdue:     'bg-red-100 text-red-700',
    cancelled:   'bg-red-100 text-red-700',
    expired:     'bg-orange-100 text-orange-700',
    low:         'bg-gray-100 text-gray-600',
    medium:      'bg-yellow-100 text-yellow-700',
    high:        'bg-orange-100 text-orange-700',
    urgent:      'bg-red-100 text-red-700',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
