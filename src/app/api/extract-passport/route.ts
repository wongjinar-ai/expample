export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ name: '', passport_number: '', error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
  }

  const { imageBase64, mediaType } = await request.json() as { imageBase64: string; mediaType: string }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: 'Extract from this passport or ID document: (1) the full name in "GIVEN NAMES SURNAME" order as it appears, (2) the passport/document number from the top-right field. Reply with ONLY valid JSON: {"name":"...","passport_number":"..."}. If not a passport/ID or unreadable, return {"name":"","passport_number":""}.',
          },
        ],
      }],
    }),
  })

  const data = await res.json() as { content?: Array<{ text: string }> }
  const text = data.content?.[0]?.text ?? ''
  try {
    const match = text.match(/\{[^{}]+\}/)
    return Response.json(JSON.parse(match?.[0] ?? text))
  } catch {
    return Response.json({ name: '', passport_number: '' })
  }
}
