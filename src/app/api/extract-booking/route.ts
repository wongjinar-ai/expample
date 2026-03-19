export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })
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
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `This is a hotel booking screenshot from an OTA (Booking.com, Agoda, Airbnb) or direct booking confirmation. Extract the booking details and return ONLY valid JSON:
{
  "guest": "full guest name",
  "checkin": "YYYY-MM-DD",
  "checkout": "YYYY-MM-DD",
  "guests": 1,
  "units": 1,
  "source": "Booking.com|Agoda|Airbnb|Direct|Other",
  "gross": 0,
  "comm": 0,
  "booking_ref": "confirmation number",
  "special": "special requests if any"
}
For "gross": the TOTAL price paid by the guest across all units. For "comm": the total OTA commission/service fee deducted. For "units": number of rooms/units booked (look for "Total units", "2 rooms", etc.) — default 1. Use "" for unknown strings, 0 for unknown numbers. Dates must be YYYY-MM-DD. Return ONLY the JSON object.`,
          },
        ],
      }],
    }),
  })

  const data = await res.json() as { content?: Array<{ text: string }> }
  const text = data.content?.[0]?.text ?? ''
  try {
    const match = text.match(/\{[\s\S]*\}/)
    return Response.json(JSON.parse(match?.[0] ?? text))
  } catch {
    return Response.json({})
  }
}
