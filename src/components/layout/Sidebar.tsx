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

  const today = new Date()
  const dateStr = today.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <aside
      className="flex flex-col h-full w-56 shrink-0 px-3 py-5"
      style={{ background: 'var(--accent)', borderRight: '1px solid #4a1570' }}
    >
      {/* Logo */}
      <div className="px-3 mb-8">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ fontSize: '1.5rem' }}>🐸</span>
          <h1
            className="text-xl leading-tight"
            style={{ fontFamily: 'var(--font-fraunces)', color: '#ffffff' }}
          >
            Himmapun
          </h1>
        </div>
        <p className="text-xs uppercase tracking-widest" style={{ color: '#d8b4fe', marginLeft: '2.2rem' }}>
          Retreat
        </p>
        <p className="text-xs mt-2" style={{ color: '#c4b0d8', fontFamily: 'var(--font-dm-mono)', fontSize: '0.7rem' }}>
          {dateStr}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
              style={{
                background: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: active ? '#ffffff' : '#d8b4fe',
                fontWeight: active ? 500 : 400,
              }}
            >
              <span style={{ fontSize: '1rem', opacity: active ? 1 : 0.7 }}>{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm w-full transition-all mt-2"
        style={{ color: '#c4b0d8' }}
      >
        <span style={{ opacity: 0.7 }}>↩</span>
        Sign out
      </button>
    </aside>
  )
}
