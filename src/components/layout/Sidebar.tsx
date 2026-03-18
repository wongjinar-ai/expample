'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/dashboard', label: 'Dashboard',  icon: '⊞' },
  { href: '/day-guest', label: 'Day Guest',   icon: '☀' },
  { href: '/bookings',  label: 'Bookings',    icon: '≡' },
  { href: '/cleaning',  label: 'Cleaning',    icon: '✦' },
  { href: '/shifts',    label: 'Shifts',      icon: '◷' },
  { href: '/monthly',   label: 'Monthly',     icon: '▦' },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Format today's date
  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <aside className="flex flex-col h-full w-56 shrink-0 px-3 py-5" style={{ background: 'var(--surface)', borderRight: '1px solid #1e201d' }}>

      {/* Logo */}
      <div className="px-3 mb-6">
        <h1 className="text-lg leading-tight" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--accent)' }}>
          Himmapun<br />Retreat
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>{dateStr}</p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{
                background: active ? 'var(--surface2)' : 'transparent',
                color: active ? 'var(--text)' : 'var(--muted)',
              }}
            >
              <span style={{ fontSize: '1rem' }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm w-full transition-colors mt-2"
        style={{ color: 'var(--muted)' }}
      >
        <span>↩</span>
        Sign out
      </button>
    </aside>
  )
}
