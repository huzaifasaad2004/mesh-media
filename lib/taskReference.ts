export function normalizeTaskReferenceUrl(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string') throw new Error('Google Drive link must be a URL')
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter a valid Google Drive link')
  }
  if (url.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(url.hostname.toLowerCase())) {
    throw new Error('Use a Google Drive or Google Docs link beginning with https://')
  }
  return url.toString()
}
