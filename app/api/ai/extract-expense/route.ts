import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { extractExpenseFromText, extractExpenseFromImage } from '@/lib/expenseExtraction'

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  try {
    const { text, image_base64, mime_type } = await req.json()
    const result = image_base64
      ? await extractExpenseFromImage(image_base64, mime_type || 'image/jpeg', text)
      : await extractExpenseFromText(text)
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
