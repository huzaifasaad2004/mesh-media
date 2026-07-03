// ── app/api/celine/expense-capture/route.ts ─────────────────────────
// Lets Celine (Telegram bot) log an expense from a photo of a receipt, a
// transcribed voice note, or a plain text message — same extraction
// pipeline the in-app "Record Expense" quick-add uses.
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { celineAuthorized } from '@/lib/celine/auth'
import { extractExpenseFromText, extractExpenseFromImage } from '@/lib/expenseExtraction'
import { emitCelineEvent } from '@/lib/celine/events'

const admin = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(req: NextRequest) {
  if (!celineAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { text, image_base64, mime_type, client_id, requested_by } = await req.json()
  if (!text && !image_base64) return NextResponse.json({ error: 'text or image_base64 required' }, { status: 400 })

  let extracted
  try {
    extracted = image_base64
      ? await extractExpenseFromImage(image_base64, mime_type || 'image/jpeg', text)
      : await extractExpenseFromText(text)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }

  if (extracted.confidence === 'low' || extracted.amount <= 0) {
    // Don't silently create a bad record — hand back what we found so
    // Celine can ask the user to confirm/clarify in Telegram.
    return NextResponse.json({ ok: false, needs_confirmation: true, extracted })
  }

  const db = admin()
  const { data: expense, error } = await db.from('expenses').insert({
    category: extracted.category,
    description: extracted.description,
    amount: extracted.amount,
    date: extracted.date || new Date().toISOString().split('T')[0],
    client_id: client_id ?? null,
    created_by: requested_by ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  await emitCelineEvent('expense_captured', 'admin', {
    expense_id: expense.id,
    description: expense.description,
    amount: expense.amount,
    category: expense.category,
  })

  return NextResponse.json({ ok: true, expense })
}
