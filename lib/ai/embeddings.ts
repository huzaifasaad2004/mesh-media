const EMBED_MODEL = 'text-embedding-004'

/** Gemini text-embedding-004 — 768-dimension vectors, matches embeddings.embedding in phase36. */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text: text.slice(0, 8000) }] } }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error?.message ?? 'Gemini embedding error')
  return data.embedding.values
}

/** pgvector's text literal format for a plain array of floats. */
export const toVectorLiteral = (values: number[]) => `[${values.join(',')}]`
