import { NextRequest, NextResponse } from 'next/server'
import { serviceRole } from '@/lib/apiAuth'
import { requireCronOrManager } from '@/lib/cron'
import { generateEmbedding, toVectorLiteral } from '@/lib/ai/embeddings'

export const runtime = 'nodejs'
export const maxDuration = 300

type Row = { entity_type: 'client' | 'project' | 'task' | 'client_note'; entity_id: string; client_id: string | null; content: string }

// Re-embeds every client, project, task, and client note — small agency-scale
// data volume, so a full nightly re-embed (idempotent upsert on entity_type+id)
// is simpler and cheaper to reason about than tracking per-row dirty state.
async function run(req: NextRequest) {
  const auth = await requireCronOrManager(req)
  if ('res' in auth) return auth.res

  const db = serviceRole()
  const rows: Row[] = []

  const { data: clients } = await db.from('clients').select('id, company_name, industry, notes, status')
  for (const c of clients ?? []) {
    const content = [c.company_name, c.industry, c.status, c.notes].filter(Boolean).join(' — ')
    if (content.trim()) rows.push({ entity_type: 'client', entity_id: c.id, client_id: c.id, content })
  }

  const { data: projects } = await db.from('projects').select('id, name, description, status, client_id')
  for (const p of projects ?? []) {
    const content = [p.name, p.status, p.description].filter(Boolean).join(' — ')
    if (content.trim()) rows.push({ entity_type: 'project', entity_id: p.id, client_id: p.client_id, content })
  }

  const { data: tasks } = await db.from('tasks').select('id, title, description, status, priority, client_id')
  for (const t of tasks ?? []) {
    const content = [t.title, t.status, t.priority, t.description].filter(Boolean).join(' — ')
    if (content.trim()) rows.push({ entity_type: 'task', entity_id: t.id, client_id: t.client_id, content })
  }

  const { data: notes } = await db.from('client_notes').select('id, content, client_id')
  for (const n of notes ?? []) {
    if (n.content?.trim()) rows.push({ entity_type: 'client_note', entity_id: n.id, client_id: n.client_id, content: n.content })
  }

  let embedded = 0
  const errors: string[] = []

  // Sequential, not parallel — stays well under Gemini's embedding rate limit.
  for (const row of rows) {
    try {
      const values = await generateEmbedding(row.content)
      const { error } = await db.from('embeddings').upsert({
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        client_id: row.client_id,
        content: row.content,
        embedding: toVectorLiteral(values),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'entity_type,entity_id' })
      if (error) errors.push(`${row.entity_type}:${row.entity_id} — ${error.message}`)
      else embedded++
    } catch (e: any) {
      errors.push(`${row.entity_type}:${row.entity_id} — ${e.message}`)
    }
  }

  return NextResponse.json({ embedded, total: rows.length, errors: errors.slice(0, 10) })
}

export async function GET(req: NextRequest) { return run(req) }
export async function POST(req: NextRequest) { return run(req) }
