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
    .select('id, passport_url, passport_uploaded_at, guest2_passport_url, guest2_passport_uploaded_at')
    .or(`passport_uploaded_at.lt.${oneMonthAgo.toISOString()},guest2_passport_uploaded_at.lt.${oneMonthAgo.toISOString()}`)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  let deleted = 0
  for (const booking of bookings ?? []) {
    const updates: Record<string, null> = {}
    const toRemove: string[] = []

    if (booking.passport_url && booking.passport_uploaded_at < oneMonthAgo.toISOString()) {
      toRemove.push(booking.passport_url)
      updates.passport_url = null
      updates.passport_uploaded_at = null
    }
    if (booking.guest2_passport_url && booking.guest2_passport_uploaded_at < oneMonthAgo.toISOString()) {
      toRemove.push(booking.guest2_passport_url)
      updates.guest2_passport_url = null
      updates.guest2_passport_uploaded_at = null
    }

    if (toRemove.length > 0) {
      await supabase.storage.from(BUCKET).remove(toRemove)
      await supabase.from('bookings').update(updates).eq('id', booking.id)
      deleted++
    }
  }

  return Response.json({ deleted, checked: (bookings ?? []).length })
}
