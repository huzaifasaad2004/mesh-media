export type Role = 'owner' | 'admin' | 'manager' | 'member' | 'viewer' | 'client'

export const STAFF_ROLES: Role[] = ['owner', 'admin', 'manager', 'member', 'viewer']

export const isStaff = (role?: string | null) => STAFF_ROLES.includes(role as Role)
export const isAdmin = (role?: string | null) => role === 'owner' || role === 'admin'
export const canSeeFinance = (role?: string | null) =>
  ['owner', 'admin', 'manager', 'viewer'].includes(role ?? '')
export const canManageTeam = isAdmin
export const canManageSettings = isAdmin

/** Which sidebar items a role can see (href prefixes) */
export function navVisible(role: string | null | undefined, href: string): boolean {
  if (href === '/finance') return canSeeFinance(role)
  if (href === '/team') return canManageTeam(role)
  if (href === '/settings') return canManageSettings(role)
  return isStaff(role)
}
