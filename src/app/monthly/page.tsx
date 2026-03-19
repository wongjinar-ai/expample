import { redirect } from 'next/navigation'

export default function MonthlyPage() {
  redirect('/dashboard?tab=income')
}
