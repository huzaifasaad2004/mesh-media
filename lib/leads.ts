const LEAD_FIELDS = [
  'company_name', 'contact_name', 'email', 'phone', 'website', 'source',
  'stage_id', 'estimated_value', 'currency', 'next_follow_up', 'notes', 'assigned_to',
] as const

/** Keep only known lead columns, trimming strings and blanking empties to null. */
export function pickLeadFields(body: Record<string, unknown>) {
  const clean: Record<string, unknown> = {}
  for (const key of LEAD_FIELDS) {
    if (!(key in body)) continue
    const v = body[key]
    clean[key] = typeof v === 'string' ? (v.trim() || null) : v ?? null
  }
  return clean
}

export const LEAD_SELECT =
  '*, stage:pipeline_stages(id, name, position), assignee:profiles!leads_assigned_to_fkey(id, full_name, avatar_url)'

export const LEAD_SOURCES = [
  { value: 'referral',         label: 'Referral' },
  { value: 'instagram',        label: 'Instagram' },
  { value: 'website',          label: 'Website' },
  { value: 'cold_outreach',    label: 'Cold Outreach' },
  { value: 'event',            label: 'Event' },
  { value: 'existing_network', label: 'Existing Network' },
  { value: 'other',            label: 'Other' },
]
