import { redirect } from 'next/navigation'

export default function CleaningPage() {
  redirect('/dashboard?tab=cleaning')
}
