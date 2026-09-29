'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ExternalLink } from 'lucide-react'

/**
 * Renders one page of a PDF to a canvas via pdf.js and reports the page
 * count + rendered pixel size, so callers can overlay absolutely-positioned
 * fields on top using fraction coordinates (field.x * renderedWidth, etc).
 *
 * `width` is the maximum — the page shrinks to fit narrower screens. Any
 * failure is shown with a link to open the PDF directly; a silent empty
 * canvas was indistinguishable from "still loading".
 */
export default function PdfPageCanvas({
  fileUrl, pageNumber, width, onDocumentLoad, onPageRender, children,
}: {
  fileUrl: string
  pageNumber: number
  width: number
  onDocumentLoad?: (numPages: number) => void
  onPageRender?: (size: { width: number; height: number }) => void
  children?: React.ReactNode
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const docRef = useRef<any>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [fitWidth, setFitWidth] = useState(width)
  const [error, setError] = useState('')
  // The load effect's async callback outlives the render it started in — read the live
  // page/width from refs so a slow download doesn't draw with stale values.
  const liveRef = useRef({ pageNumber, fitWidth })
  liveRef.current = { pageNumber, fitWidth }

  useEffect(() => {
    const outer = outerRef.current
    if (!outer) return
    const measure = () => setFitWidth(Math.max(240, Math.min(width, Math.floor(outer.clientWidth))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(outer)
    return () => observer.disconnect()
  }, [width])

  useEffect(() => {
    let cancelled = false
    setError('')
    setSize(null)
    docRef.current = null
    ;(async () => {
      try {
        const res = await fetch(fileUrl, { credentials: 'same-origin' })
        if (!res.ok) {
          const body = await res.json().catch(() => null)
          throw new Error(body?.error ?? `The document could not be loaded (${res.status})`)
        }
        const data = new Uint8Array(await res.arrayBuffer())
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        const doc = await pdfjsLib.getDocument({ data }).promise
        if (cancelled) return
        docRef.current = doc
        onDocumentLoad?.(doc.numPages)
        await renderPage()
      } catch (e: any) {
        console.error('[PdfPageCanvas] failed to render', fileUrl, e)
        if (!cancelled) setError(e?.message || 'The document could not be displayed')
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  useEffect(() => { if (docRef.current) renderPage().catch(() => {}) }, [pageNumber, fitWidth]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderPage = async () => {
    const doc = docRef.current
    const canvas = canvasRef.current
    const { pageNumber, fitWidth } = liveRef.current
    if (!doc || !canvas || pageNumber > doc.numPages) return
    const page = await doc.getPage(pageNumber)
    const unscaled = page.getViewport({ scale: 1 })
    const scale = fitWidth / unscaled.width
    const viewport = page.getViewport({ scale })
    // Draw at device resolution so text stays crisp on retina/phone screens.
    const ratio = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * ratio)
    canvas.height = Math.floor(viewport.height * ratio)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    await page.render({ canvasContext: ctx, viewport }).promise
    setSize({ width: viewport.width, height: viewport.height })
    onPageRender?.({ width: viewport.width, height: viewport.height })
  }

  return (
    <div ref={outerRef} className="w-full">
      {error ? (
        <div className="rounded-lg border border-sand-300 bg-paper-50 px-6 py-10 text-center" style={{ maxWidth: width }}>
          <p className="text-sm font-medium" style={{ color: 'var(--danger, #B23A2E)' }}>{error}</p>
          <a href={fileUrl} target="_blank" rel="noreferrer" className="btn-secondary btn-sm inline-flex mt-4">
            <ExternalLink className="w-3.5 h-3.5" /> Open the PDF
          </a>
        </div>
      ) : (
        <div className="relative inline-block" style={{ width: size?.width, height: size?.height }}>
          {!size && (
            <div className="flex items-center justify-center gap-2 rounded-lg border border-sand-300 bg-paper-50 text-sm text-taupe-500" style={{ width: fitWidth, height: Math.round(fitWidth * 1.3) }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Loading document…
            </div>
          )}
          <canvas ref={canvasRef} className={`block border border-sand-300 rounded-lg ${size ? '' : 'hidden'}`} />
          {size && children}
        </div>
      )}
    </div>
  )
}
