'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surfaced in the browser console + Vercel logs for diagnosis
    console.error('App error boundary caught:', error)
  }, [error])

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 420 }}>
        <img src="/brand/mm_mark_maroon.png" alt="Mesh Media" style={{ width: 40, height: 48, objectFit: 'contain', margin: '0 auto 12px' }} />
        <h2 style={{ fontFamily: 'var(--font-cormorant), Georgia, serif', fontSize: 22, color: '#151312', marginBottom: 6 }}>
          Something went wrong on this page
        </h2>
        <p style={{ fontSize: 14, color: '#6E655B', marginBottom: 20 }}>
          The rest of the app is fine — this one screen hit an error. Try again, or head back to your dashboard.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button onClick={reset} className="btn-primary">Try again</button>
          <a href="/dashboard" className="btn-secondary">Go to dashboard</a>
        </div>
      </div>
    </div>
  )
}
