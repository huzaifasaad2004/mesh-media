'use client'

// Catches errors thrown in the root layout itself (where the normal
// app/error.tsx boundary can't reach). Must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#FAF9F5', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 420 }}>
            <h2 style={{ fontSize: 22, color: '#151312', marginBottom: 6 }}>Mesh Media hit an unexpected error</h2>
            <p style={{ fontSize: 14, color: '#6E655B', marginBottom: 20 }}>Please try again. If it keeps happening, refresh the page.</p>
            <button onClick={reset} style={{ background: '#6E1318', color: '#F3EEE6', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
