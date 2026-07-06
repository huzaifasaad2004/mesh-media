/**
 * window.print() captures whatever is rendered at the instant it's called.
 * If the logo/signature <img> tags haven't finished decoding yet, the print
 * engine renders that spot blank — and on a slow first load, or a print
 * dialog opened right after navigation, this is exactly what happens.
 * Wait for every image on the page to actually decode before printing.
 */
export async function waitForImages(): Promise<void> {
  const images = Array.from(document.images)
  await Promise.all(
    images.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve()
      if (typeof img.decode === 'function') {
        return img.decode().catch(() => new Promise<void>(resolve => {
          img.addEventListener('load', () => resolve(), { once: true })
          img.addEventListener('error', () => resolve(), { once: true })
        }))
      }
      return new Promise<void>(resolve => {
        img.addEventListener('load', () => resolve(), { once: true })
        img.addEventListener('error', () => resolve(), { once: true })
      })
    })
  )
}
