import * as crypto from 'crypto'

/** AES-256-GCM, key derived from TOKEN_ENCRYPTION_KEY (hex or arbitrary
 *  string — hashed to 32 bytes either way). Deliberately a separate secret
 *  from Celine's own TOKEN_ENCRYPTION_KEY even though the pattern is
 *  identical — a leaked key in one app shouldn't unlock the other's tokens. */
function key(): Buffer {
  const k = process.env.TOKEN_ENCRYPTION_KEY
  if (!k) throw new Error('TOKEN_ENCRYPTION_KEY is not set')
  if (/^[0-9a-f]{64}$/i.test(k)) return Buffer.from(k, 'hex')
  return crypto.createHash('sha256').update(k).digest()
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64')
}

export function decrypt(ciphertext: string): string {
  const raw = Buffer.from(ciphertext, 'base64')
  const iv = raw.subarray(0, 12)
  const tag = raw.subarray(12, 28)
  const enc = raw.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}
