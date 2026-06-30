import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = { title: 'Mesh Media' }

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant:ital,wght@0,400;0,600;1,400;1,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
        <style>{`
          @media print {
            @page { margin: 0; size: A4; }
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body { background: #f5f5f5; margin: 0; font-family: 'Inter', sans-serif; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  )
}
