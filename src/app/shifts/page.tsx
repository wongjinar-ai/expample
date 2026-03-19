import { redirect } from 'next/navigation'

export default function ShiftsPage() {
  redirect('/dashboard?tab=shifts')
}
