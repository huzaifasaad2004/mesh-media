const CATEGORIES = ['software', 'ads', 'freelancer', 'office', 'travel', 'other']

export interface ExtractedExpense {
  description: string
  amount: number
  category: string
  date: string | null
  confidence: 'high' | 'low'
}

const PROMPT = `You are extracting a business expense record for a marketing agency's finance system.
Categories (pick exactly one): ${CATEGORIES.join(', ')}.
Today's date is ${new Date().toISOString().split('T')[0]}.

Reply with ONLY a JSON object, no markdown fences, matching this shape:
{"description": "short vendor/purpose description", "amount": <number, no currency symbol>, "category": "<one of the categories>", "date": "YYYY-MM-DD or null if not stated/visible", "confidence": "high" or "low"}

If you cannot confidently find an amount, set amount to 0 and confidence to "low".`

async function callGemini(parts: any[]): Promise<ExtractedExpense> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        // Gemini 2.5 "thinks" by default and that thinking counts against
        // maxOutputTokens — with a small cap the JSON came back cut off.
        // Turn thinking off and ask for JSON directly.
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1024,
          responseMimeType: 'application/json',
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
  const outParts: any[] = data.candidates?.[0]?.content?.parts ?? []
  const text: string = outParts.filter((p) => !p.thought && typeof p.text === 'string').map((p) => p.text).join('') || '{}'
  const cleaned = text.replace(/```json\s*|```/g, '').trim().replace(/^[^{]*/, '').replace(/[^}]*$/, '')

  let parsed: any
  try { parsed = JSON.parse(cleaned) } catch { throw new Error('Could not parse a receipt/expense from that') }

  const category = CATEGORIES.includes(parsed.category) ? parsed.category : 'other'
  return {
    description: String(parsed.description ?? 'Expense').slice(0, 200),
    amount: Number(parsed.amount) || 0,
    category,
    date: parsed.date && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date) ? parsed.date : null,
    confidence: parsed.confidence === 'high' ? 'high' : 'low',
  }
}

/** Extract an expense from a free-text description (typed, or voice-transcribed by the caller). */
export function extractExpenseFromText(text: string): Promise<ExtractedExpense> {
  return callGemini([{ text: `${PROMPT}\n\nMessage: "${text}"` }])
}

/** Extract an expense from a photographed/screenshotted receipt. */
export function extractExpenseFromImage(base64Data: string, mimeType: string, caption?: string): Promise<ExtractedExpense> {
  return callGemini([
    { text: caption ? `${PROMPT}\n\nThe sender also wrote: "${caption}"` : PROMPT },
    { inline_data: { mime_type: mimeType, data: base64Data } },
  ])
}
