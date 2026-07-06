import type { User } from '@supabase/supabase-js'
import { serviceRole } from './apiAuth'

/** Fire-and-forget audit trail write. Never let logging break the calling mutation. */
export async function logActivity(
  user: User,
  action: string,
  entityType: string,
  entityId?: string | null,
  entityLabel?: string | null
) {
  try {
    await serviceRole().from('activity_log').insert({
      actor_id: user.id,
      actor_email: user.email,
      action,
      entity_type: entityType,
      entity_id: entityId ?? null,
      entity_label: entityLabel ?? null,
    })
  } catch {
    // activity_log table may not be migrated yet — never block the real mutation on this
  }
}
