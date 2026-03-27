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
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          {
            type: 'text',
            text: `This is a receipt or invoice, possibly in Thai. Extract the following and return ONLY valid JSON:
{
  "description": "vendor or shop name (Thai or English)",
  "amount": 0,
  "date": "YYYY-MM-DD"
}

Rules:
- description: the shop/vendor name. If Thai, keep it in Thai script.
- amount: the TOTAL amount paid as an integer (no decimals). Look for ยอดรวม, รวมทั้งสิ้น, Total, ยอดชำระ, or the largest amount on the receipt.
- date: the receipt date. IMPORTANT — Thai receipts often use Buddhist Era (พ.ศ. / B.E.) which is 543 years ahead of C.E. You MUST subtract 543 to convert to C.E. before returning. For example: พ.ศ. 2567 → C.E. 2024, so return "2024-MM-DD". Always return date as C.E. YYYY-MM-DD.
- Use "" for description if unreadable, 0 for amount if unreadable, "" for date if unreadable.
- Return ONLY the JSON object, no markdown.`,
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
    return Response.json({ description: '', amount: 0, date: '' })
  }
}
