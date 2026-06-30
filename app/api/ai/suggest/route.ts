import { NextRequest, NextResponse } from 'next/server'

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 256, temperature: 0.8 },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

export async function POST(req: NextRequest) {
  try {
    const { type, context, existing } = await req.json()

    const prompt = type === 'description'
      ? `You are writing a professional line item description for a marketing agency invoice/quotation in the UAE.

Context: ${context || 'Marketing services'}
Existing items on this document: ${existing?.length ? existing.join(', ') : 'none'}

Write ONE short, professional line item description (max 8 words, no punctuation at end).
Examples: "Social media management – June 2026", "Brand identity design package", "Monthly PR retainer services", "Google Ads campaign management"
Only reply with the description text, nothing else.`
      : `You are a professional copywriter for a UAE marketing agency.
Generate 5 different professional line item descriptions for ${context || 'marketing services'}.
Return ONLY a JSON array of strings, e.g. ["item 1", "item 2", ...]`

    const result = await callGemini(prompt)
    return NextResponse.json({ result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
