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
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `Extract from this passport or ID document. Read the PRINTED LABELED FIELDS only — do NOT read the MRZ machine-readable lines at the bottom.

Return ONLY valid JSON (no markdown, no extra text):
{
  "name": "GIVEN_NAMES SURNAME",
  "passport_number": "value from the labeled Passport No. field (top area, NOT the MRZ line)",
  "nationality": "nationality as printed",
  "dob": "YYYY-MM-DD",
  "expiry": "YYYY-MM-DD"
}

Rules:
- name: given name(s) first, then surname, all uppercase (e.g. "FLO DAVEY")
- passport_number: short alphanumeric code from the labeled Passport No./No. de passeport field — typically 6–9 characters (e.g. "150192197")
- Do NOT use the long MRZ barcode line for passport_number
- Use "" for any field you cannot read with confidence`,
          },
        ],
      }],
    }),
  })

  const data = await res.json() as { content?: Array<{ text: string }> }
  const text = data.content?.[0]?.text ?? ''
  try {
    const match = text.match(/\{[\s\S]*?\}/)
    return Response.json(JSON.parse(match?.[0] ?? text))
  } catch {
    return Response.json({ name: '', passport_number: '', nationality: '', dob: '', expiry: '' })
  }
}
