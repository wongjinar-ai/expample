'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { fmtMoney } from '@/lib/helpers'
import { OCC_ROOMS, ROOM_TYPES } from '@/lib/constants'
import type { Room } from '@/lib/constants'

interface Booking {
  id: number
  guest: string
  room: string
  guests: number
  checkin: string
  checkout: string
  status: string
  gross: number
  net_income: number
  source: string
}

function isOccupiedOn(b: Booking, dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const ci = new Date(b.checkin + 'T00:00:00')
  const co = new Date(b.checkout + 'T00:00:00')
  return ci <= d && co > d && ['Occupied', 'Check-in', 'Checkout', 'Upcoming'].includes(b.status)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

const SOURCE_COLORS: Record<string, { bg: string; color: string }> = {
  'Direct':      { bg: 'rgba(74,222,128,0.15)',  color: '#4ade80' },
  'Booking.com': { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
  'Agoda':       { bg: 'rgba(251,191,36,0.15)',  color: '#fbbf24' },
  'Airbnb':      { bg: 'rgba(255,135,255,0.15)', color: '#ff87ff' },
  'Other':       { bg: 'rgba(155,143,176,0.15)', color: '#9b8fb0' },
}

function GuestRow({ b, accent }: { b: Booking; accent: string }) {
  const type = ROOM_TYPES[b.room as Room] ?? ''
  const src = SOURCE_COLORS[b.source] ?? { bg: 'rgba(155,143,176,0.15)', color: '#9b8fb0' }
  const avatarBg = accent === '#4ade80' ? 'rgba(74,222,128,0.18)' : 'rgba(251,191,36,0.18)'
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold"
        style={{ background: avatarBg, color: accent, fontFamily: 'var(--font-dm-mono)' }}
      >
        {b.guest.trim().charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate" style={{ color: 'var(--text)' }}>{b.guest}</p>
        <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>
          {b.room} · {type} · {b.guests} guest{b.guests !== 1 ? 's' : ''}
        </p>
      </div>
      <span className="text-xs px-2.5 py-1 rounded-lg shrink-0" style={{ background: src.bg, color: src.color }}>
        {b.source}
      </span>
    </div>
  )
}

function TodayPanel({
  title,
  accent,
  bookings,
  emptyMsg,
}: {
  title: string
  accent: string
  bookings: Booking[]
  emptyMsg: string
}) {
  return (
    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #2e2040' }}>
      <div className="w-1 shrink-0" style={{ background: accent }} />
      <div className="flex-1 min-w-0">
        <div className="px-4 py-3" style={{ background: 'var(--surface)', borderBottom: '1px solid #2e2040' }}>
          <h3
            className="text-xs uppercase tracking-widest font-semibold"
            style={{ color: accent, fontFamily: 'var(--font-dm-mono)' }}
          >
            {title}
          </h3>
        </div>
        {bookings.length === 0 ? (
          <p className="px-4 py-6 text-sm" style={{ color: 'var(--muted)' }}>{emptyMsg}</p>
        ) : (
          bookings.map(b => <GuestRow key={b.id} b={b} accent={accent} />)
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const today = new Date().toISOString().slice(0, 10)
  const thisMonth = today.slice(0, 7)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('bookings')
        .select('id,guest,room,guests,checkin,checkout,status,gross,net_income,source')
        .neq('status', 'Completed')
      setBookings(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const occupiedRooms = OCC_ROOMS.filter(room =>
    bookings.some(b => b.room === room && isOccupiedOn(b, today))
  )
  const occupancyPct = Math.round((occupiedRooms.length / 10) * 100)
  const guestsToday = bookings
    .filter(b => isOccupiedOn(b, today))
    .reduce((s, b) => s + (b.guests || 0), 0)
  const checkInsToday = bookings.filter(b => b.checkin === today)
  const checkOutsToday = bookings.filter(b => b.checkout === today)
  const netMonth = bookings
    .filter(b => b.checkin.startsWith(thisMonth))
    .reduce((s, b) => s + b.net_income, 0)

  const upcoming = bookings
    .filter(b => b.checkin > today && b.checkin <= addDays(today, 3))
    .sort((a, b) => a.checkin.localeCompare(b.checkin))

  const metrics = [
    { label: 'Rooms occupied',  value: `${occupiedRooms.length}/10`,      color: 'var(--blue)' },
    { label: 'Occupancy',       value: `${occupancyPct}%`,                 color: 'var(--accent2)' },
    { label: 'Total guests',    value: String(guestsToday),                color: 'var(--green)' },
    { label: 'Check-out today', value: String(checkOutsToday.length),      color: 'var(--amber)' },
    { label: 'Check-in today',  value: String(checkInsToday.length),       color: 'var(--green)' },
    { label: 'Net income',      value: fmtMoney(netMonth),                 color: 'var(--green)' },
  ]

  return (
    <AppShell>
      <h2 className="text-2xl mb-6" style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }}>
        Dashboard
      </h2>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <>
          {/* Metric Cards — all 6 in one row */}
          <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
            {metrics.map(m => (
              <div
                key={m.label}
                className="rounded-xl p-4"
                style={{ background: 'var(--surface)', border: '1px solid #2e2040' }}
              >
                <p
                  className="uppercase tracking-wider mb-2"
                  style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.6rem' }}
                >
                  {m.label}
                </p>
                <p
                  className="text-2xl font-semibold"
                  style={{ color: m.color, fontFamily: 'var(--font-dm-mono)' }}
                >
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Today panels — Check-in left, Check-out right */}
          <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <TodayPanel
              title="Checking In Today"
              accent="#4ade80"
              bookings={checkInsToday}
              emptyMsg="No check-ins today"
            />
            <TodayPanel
              title="Checking Out Today"
              accent="#fbbf24"
              bookings={checkOutsToday}
              emptyMsg="No check-outs today"
            />
          </div>

          {/* Upcoming Check-ins — next 3 days */}
          <div>
            <h3
              className="text-xs uppercase tracking-wider mb-3"
              style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}
            >
              Upcoming Check-ins — Next 3 days
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No upcoming check-ins in the next 3 days.</p>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2e2040' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid #2e2040' }}>
                      {['Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Source'].map(h => (
                        <th
                          key={h}
                          className="px-4 py-2 text-left"
                          style={{
                            color: 'var(--muted)',
                            fontFamily: 'var(--font-dm-mono)',
                            fontSize: '0.7rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((b, i) => {
                      const nights = Math.round(
                        (new Date(b.checkout + 'T00:00:00').getTime() -
                          new Date(b.checkin + 'T00:00:00').getTime()) /
                          86400000,
                      )
                      return (
                        <tr
                          key={b.id}
                          style={{
                            background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                            borderBottom: '1px solid #2e2040',
                          }}
                        >
                          <td className="px-4 py-2" style={{ color: 'var(--text)' }}>{b.guest}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)' }}>{b.room}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--green)', fontFamily: 'var(--font-dm-mono)' }}>{b.checkin}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>{b.checkout}</td>
                          <td className="px-4 py-2 text-center" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)' }}>{nights}</td>
                          <td className="px-4 py-2" style={{ color: 'var(--muted)' }}>{b.source}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </AppShell>
  )
}
