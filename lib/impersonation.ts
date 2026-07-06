import { cookies } from 'next/headers'

const IMPERSONATOR_COOKIE = 'mm_impersonator'

export function getImpersonationInfo(): { admin_email: string; target_email: string } | null {
  const raw = cookies().get(IMPERSONATOR_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return { admin_email: parsed.admin_email, target_email: parsed.target_email }
  } catch {
    return null
  }
}
