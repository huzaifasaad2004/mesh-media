'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Renders one page of a PDF to a canvas via pdf.js and reports the page
 * count + rendered pixel size, so callers can overlay absolutely-positioned
 * fields on top using fraction coordinates (field.x * renderedWidth, etc).
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const docRef = useRef<any>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf')
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
      const doc = await pdfjsLib.getDocument(fileUrl).promise
      if (cancelled) return
      docRef.current = doc
      onDocumentLoad?.(doc.numPages)
      renderPage()
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl])

  useEffect(() => { if (docRef.current) renderPage() }, [pageNumber, width]) // eslint-disable-line react-hooks/exhaustive-deps

  const renderPage = async () => {
    const doc = docRef.current
    const canvas = canvasRef.current
    if (!doc || !canvas || pageNumber > doc.numPages) return
    const page = await doc.getPage(pageNumber)
    const unscaled = page.getViewport({ scale: 1 })
    const scale = width / unscaled.width
    const viewport = page.getViewport({ scale })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    setSize({ width: viewport.width, height: viewport.height })
    onPageRender?.({ width: viewport.width, height: viewport.height })
  }

  return (
    <div className="relative inline-block" style={{ width: size?.width, height: size?.height }}>
      <canvas ref={canvasRef} className="block border border-sand-300 rounded-lg" />
      {size && children}
    </div>
  )
}
