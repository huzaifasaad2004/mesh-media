// Client-safe (no server imports) — used by the signer page and portal alike.
export type DocumentFileVersion = 'original' | 'signed' | 'certificate'

/** Same-origin URL for a document's PDF — works for token holders and logged-in users alike. */
export function documentFileHref(documentId: string, version: DocumentFileVersion = 'original', token?: string | null) {
  const params = new URLSearchParams()
  if (version !== 'original') params.set('version', version)
  if (token) params.set('token', token)
  const query = params.toString()
  return `/api/documents/${documentId}/file${query ? `?${query}` : ''}`
}
