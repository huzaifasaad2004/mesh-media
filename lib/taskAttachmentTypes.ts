export const MAX_TASK_ATTACHMENT_BYTES = 3 * 1024 * 1024
export const MAX_TASK_ATTACHMENT_LABEL = '3MB'
export const MAX_TASK_ATTACHMENTS = 5

export const TASK_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const

export type TaskAttachment = {
  id: string
  task_id: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size: number
  uploaded_by: string | null
  created_at: string
  signed_url?: string | null
}

export function detectTaskImageMime(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png'
  if (bytes.length >= 6) {
    const header = String.fromCharCode(...Array.from(bytes.slice(0, 6)))
    if (header === 'GIF87a' || header === 'GIF89a') return 'image/gif'
  }
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(...Array.from(bytes.slice(0, 4)))
    const webp = String.fromCharCode(...Array.from(bytes.slice(8, 12)))
    if (riff === 'RIFF' && webp === 'WEBP') return 'image/webp'
  }
  return null
}

export function extensionForTaskImage(mime: string) {
  return mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]
}
