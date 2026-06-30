import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not set in environment variables' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Say hello in one word' }] }],
        }),
      }
    )
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: 'Gemini API error', detail: data }, { status: 500 })
    return NextResponse.json({ success: true, reply: data.candidates?.[0]?.content?.parts?.[0]?.text, keyPrefix: apiKey.slice(0, 8) + '...' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
