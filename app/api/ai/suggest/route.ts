import { NextRequest, NextResponse } from 'next/server'

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini error')
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
}

export async function POST(req: NextRequest) {
  try {
    const { brief, docType, subject, existing } = await req.json()

    const hasBrief = typeof brief === 'string' && brief.trim().length > 0

    const prompt = hasBrief
      ? `You are writing a line-item description for a ${docType ?? 'invoice'} from MeshMedia, a marketing & PR agency in Abu Dhabi, UAE.

The user typed this rough brief for the line item:
"${brief.trim()}"

${subject ? `The document's overall subject/project is: "${subject}".` : ''}
${existing?.length ? `Other line items already on this document: ${existing.join('; ')}.` : ''}

Rewrite the user's brief into ONE polished, professional line-item description.
Rules:
- Keep the user's meaning and specifics (names, platforms, quantities, months) — expand and professionalize them, do not replace them
- 5 to 18 words, title-style, no ending punctuation
- No quotes, no bullet points, no explanations
Reply with ONLY the description text.`
      : `You are writing a line-item description for a ${docType ?? 'invoice'} from MeshMedia, a marketing & PR agency in Abu Dhabi, UAE.
${subject ? `The document's subject/project is: "${subject}".` : ''}
${existing?.length ? `Line items already on this document: ${existing.join('; ')}. Suggest something complementary, not a duplicate.` : ''}

Write ONE professional line-item description relevant to this document (5-14 words, no ending punctuation).
Examples of tone: "Social media management and content creation – July 2026", "Brand identity design package including logo and guidelines".
Reply with ONLY the description text.`

    let result = await callGemini(prompt)
    // Strip wrapping quotes/markdown the model sometimes adds
    result = result.split('\n')[0].replace(/^["'`*\s]+|["'`*\s]+$/g, '')
    return NextResponse.json({ result })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
