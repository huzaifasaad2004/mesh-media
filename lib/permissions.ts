import type { SupabaseClient } from '@supabase/supabase-js'

/** Effective permission set for a user: role defaults with per-user overrides applied. */
export async function getEffectivePermissions(db: SupabaseClient, userId: string, role: string): Promise<Set<string>> {
  const [{ data: rolePerms }, { data: overrides }] = await Promise.all([
    db.from('role_permissions').select('permission').eq('role', role),
    db.from('user_permissions').select('permission, granted').eq('user_id', userId),
  ])
  const effective = new Set((rolePerms ?? []).map((r: any) => r.permission))
  for (const o of overrides ?? []) {
    if (o.granted) effective.add(o.permission)
    else effective.delete(o.permission)
  }
  return effective
}

export async function hasPermission(db: SupabaseClient, userId: string, role: string, permission: string): Promise<boolean> {
  const effective = await getEffectivePermissions(db, userId, role)
  return effective.has(permission)
}
