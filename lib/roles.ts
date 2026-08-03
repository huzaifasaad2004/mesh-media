export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | 'client' | 'contractor'

export const STAFF_ROLES: Role[] = ['owner', 'admin', 'manager', 'member', 'viewer']

export const isStaff = (role?: string | null) => STAFF_ROLES.includes(role as Role)
export const isAdmin = (role?: string | null) => role === 'owner' || role === 'admin'
export const canManageTeam = isAdmin
export const canManageSettings = isAdmin

/**
 * Which sidebar items a person can see. Owner/admin always see everything.
 * For everyone else, a handful of sensitive sections are gated by their
 * REAL effective permission set (role defaults + any per-person overrides
 * an admin has granted/revoked) rather than a hardcoded role list — so
 * "give this one manager finance access but not team management" works.
 */
export function navVisible(role: string | null | undefined, href: string, permissions?: string[]): boolean {
  if (isAdmin(role)) return true
  const has = (key: string) => permissions?.includes(key) ?? false

  if (href === '/finance') return has('finance.read')
  if (href === '/team') return has('team.manage')
  if (href === '/settings') return has('settings.manage')
  if (href === '/contractors') return has('contractors.read') || has('contractors.write')
  if (href === '/crm') return has('leads.read') || has('leads.write')
  if (href === '/media') return has('media.read') || has('media.write')
  if (href === '/knowledge') return has('kb.read') || has('kb.write')
  if (href === '/creative-lab') return has('creative.read') || has('creative.write')
  return isStaff(role)
}
