export async function generateCampaignInsights(input: { clientName:string; start:string; end:string; language?:string; data:any }) {
  if (!process.env.GEMINI_API_KEY) return null
  const d = input.data
  const compact = { totals:d.totals, comparison:d.comparison, pacing:d.pacing, forecast:d.forecast, alerts:d.alerts, crm:d.crm, topCampaigns:d.campaigns.slice(0,8).map((c:any)=>({name:c.name,spend:c.spend,ctr:c.ctr,conversions:c.conversions,cpa:c.cpa,roas:c.roas,qualityScore:c.qualityScore})) }
  const language = input.language === 'ar' ? 'professional Arabic' : input.language === 'bilingual' ? 'English with an Arabic translation for the summary' : 'clear professional English'
  const prompt = `You are MeshMedia's senior paid-media strategist in Abu Dhabi. Analyse ${input.clientName}'s report from ${input.start} to ${input.end}.\nData: ${JSON.stringify(compact)}\nWrite in ${language}. Return ONLY valid JSON matching: {"summary":"2 concise paragraphs","wins":["..."],"risks":["..."],"recommendations":["specific action..."],"clientHeadline":"one plain-language sentence"}. Be honest about missing values, never invent facts, distinguish platform conversions from qualified CRM leads, and give 3-5 specific recommendations.`
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{role:'user',parts:[{text:prompt}]}],generationConfig:{responseMimeType:'application/json',temperature:.25,maxOutputTokens:1400}}) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.error?.message ?? 'AI analysis failed')
  return JSON.parse(payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}')
}
