'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export type Tab = 'dashboard' | 'rooms' | 'income' | 'cleaning' | 'shifts' | 'accounts'

const TABS: { id: Tab; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'rooms',     label: 'Rooms & guests' },
  { id: 'income',    label: 'Income & OTA' },
  { id: 'cleaning',  label: 'Cleaning plan' },
  { id: 'shifts',    label: 'Staff shifts' },
  { id: 'accounts',  label: 'Accounts' },
]

export default function TopTabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}) {
  const router = useRouter()
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ background: 'var(--bg)', borderBottom: '0.5px solid var(--border2)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px 0' }}>
        <div>
          <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)' }}>Himmapun Retreat</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{today}</div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            fontSize: '12px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: '0.5px solid var(--border2)',
            background: 'transparent',
            color: 'var(--text)',
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>

      {/* Tab row */}
      <div style={{ display: 'flex', gap: 0, padding: '0 24px', marginTop: '4px' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--text)' : 'var(--muted)',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--text)' : '2px solid transparent',
              fontWeight: activeTab === tab.id ? 500 : 400,
              background: 'transparent',
              marginBottom: '-0.5px',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}
