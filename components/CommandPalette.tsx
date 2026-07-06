'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, ArrowRight, Loader2 } from 'lucide-react'

type Result = { type: string; label: string; href: string }

const PAGES: Result[] = [
  { type: 'Page', label: 'Dashboard', href: '/dashboard' },
  { type: 'Page', label: 'Clients', href: '/clients' },
  { type: 'Page', label: 'Projects', href: '/projects' },
  { type: 'Page', label: 'Tasks', href: '/tasks' },
  { type: 'Page', label: 'Time', href: '/time' },
  { type: 'Page', label: 'Finance', href: '/finance' },
  { type: 'Page', label: 'Invoices', href: '/finance/invoices' },
  { type: 'Page', label: 'Quotations', href: '/finance/quotations' },
  { type: 'Page', label: 'Expenses', href: '/finance/expenses' },
  { type: 'Page', label: 'Salaries', href: '/finance/salaries' },
  { type: 'Page', label: 'Contracts', href: '/contracts' },
  { type: 'Page', label: 'Files', href: '/files' },
  { type: 'Page', label: 'Team', href: '/team' },
  { type: 'Page', label: 'Settings', href: '/settings' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setActiveIndex(0)
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      } else if (e.key === 'Escape') {
        close()
      }
    }
    const onOpenEvent = () => setOpen(true)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('mm:open-command-palette', onOpenEvent)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('mm:open-command-palette', onOpenEvent)
    }
  }, [close])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  const matchingPages = PAGES.filter((p) => p.label.toLowerCase().includes(query.trim().toLowerCase()))

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(Array.isArray(data) ? data : [])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  useEffect(() => setActiveIndex(0), [query])

  const combined = [...matchingPages, ...results]

  const go = (href: string) => {
    router.push(href)
    close()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4" onClick={close}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full max-w-lg bg-white rounded-xl shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, combined.length - 1)) }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)) }
          else if (e.key === 'Enter') { e.preventDefault(); const r = combined[activeIndex]; if (r) go(r.href) }
        }}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {loading ? <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" /> : <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a client, invoice, task, or page…"
            className="flex-1 text-sm focus:outline-none bg-transparent placeholder:text-gray-400"
          />
          <kbd className="text-[10px] text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {combined.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">
              {query.trim().length < 2 ? 'Type to search across the app' : 'No results'}
            </p>
          ) : combined.map((r, i) => (
            <button
              key={`${r.type}-${r.href}-${i}`}
              onClick={() => go(r.href)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${i === activeIndex ? 'bg-brand-50' : ''}`}
            >
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-16 flex-shrink-0">{r.type}</span>
              <span className="flex-1 truncate text-gray-800">{r.label}</span>
              <ArrowRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
