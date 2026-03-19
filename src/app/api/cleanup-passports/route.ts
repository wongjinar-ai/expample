import { createClient } from '@supabase/supabase-js'

const BUCKET = 'booking-docs'

// Called daily by Vercel cron. Deletes passport files uploaded more than 1 month ago.
export async function GET(request: Request) {
  // Vercel cron sends: Authorization: Bearer {CRON_SECRET}
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, passport_url')
    .not('passport_url', 'is', null)
    .lt('passport_uploaded_at', oneMonthAgo.toISOString())

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let deleted = 0
  for (const booking of bookings ?? []) {
    if (!booking.passport_url) continue
    await supabase.storage.from(BUCKET).remove([booking.passport_url])
    await supabase
      .from('bookings')
      .update({ passport_url: null, passport_uploaded_at: null })
      .eq('id', booking.id)
    deleted++
  }

  return Response.json({ deleted, checked: (bookings ?? []).length })
}
