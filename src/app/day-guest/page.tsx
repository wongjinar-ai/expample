import { redirect } from 'next/navigation'

export default function DayGuestPage() {
  redirect('/dashboard?tab=rooms')
}
