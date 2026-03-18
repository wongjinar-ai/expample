'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { ROOMS } from '@/lib/constants'

interface Booking {
  id: number
  guest: string
  room: string
  checkin: string
  checkout: string
  status: string
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function isOccupiedOn(b: Booking, dateStr: string): boolean {
  const d = new Date(dateStr + 'T00:00:00')
  const ci = new Date(b.checkin + 'T00:00:00')
  const co = new Date(b.checkout + 'T00:00:00')
  return ci <= d && co > d && ['Occupied', 'Check-in', 'Checkout', 'Upcoming'].includes(b.status)
}

function fmtHeader(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

const CELL_BG: Record<string, { bg: string; color: string }> = {
  'Check-in':  { bg: 'rgba(74,222,128,0.2)',  color: '#4ade80' },
  'Occupied':  { bg: 'rgba(96,165,250,0.2)',  color: '#60a5fa' },
  'Checkout':  { bg: 'rgba(251,191,36,0.2)',  color: '#fbbf24' },
  'Upcoming':  { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' },
}

export default function DayGuestPage() {
  const today = new Date().toISOString().slice(0, 10)
  const [startDate, setStartDate] = useState(today)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)

  const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i))

  useEffect(() => {
    async function load() {
      setLoading(true)
      const supabase = createClient()
      const windowStart = startDate
      const windowEnd = addDays(startDate, 7)
      const { data } = await supabase
        .from('bookings')
        .select('id,guest,room,checkin,checkout,status')
        .lt('checkin', windowEnd)
        .gte('checkout', windowStart)
        .neq('status', 'Completed')
      setBookings(data ?? [])
      setLoading(false)
    }
    load()
  }, [startDate])

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl" style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }}>
          Day Guest
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStartDate(d => addDays(d, -7))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid #3a2d50' }}
          >
            ‹
          </button>
          <span className="text-sm px-3" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
            {fmtHeader(days[0])} — {fmtHeader(days[6])}
          </span>
          <button
            onClick={() => setStartDate(d => addDays(d, 7))}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-lg"
            style={{ background: 'var(--surface2)', color: 'var(--text)', border: '1px solid #3a2d50' }}
          >
            ›
          </button>
          {startDate !== today && (
            <button
              onClick={() => setStartDate(today)}
              className="text-xs px-3 py-1 rounded-lg ml-2"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2e2040' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid #2e2040' }}>
                <th className="px-3 py-3 text-left" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)', minWidth: '6rem' }}>Room</th>
                {days.map(d => (
                  <th key={d} className="px-2 py-3 text-center" style={{
                    color: d === today ? 'var(--accent2)' : 'var(--muted)',
                    fontFamily: 'var(--font-dm-mono)',
                    fontWeight: d === today ? 600 : 400,
                  }}>
                    {fmtHeader(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROOMS.map((room, i) => (
                <tr key={room} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'transparent', borderBottom: '1px solid #2e2040' }}>
                  <td className="px-3 py-2.5" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)', fontWeight: 500 }}>{room}</td>
                  {days.map(d => {
                    const booking = bookings.find(b => b.room === room && isOccupiedOn(b, d))
                    const style = booking ? (CELL_BG[booking.status] ?? { bg: 'rgba(96,165,250,0.12)', color: '#60a5fa' }) : null
                    return (
                      <td key={d} className="px-1 py-2 text-center">
                        {booking ? (
                          <span
                            className="inline-block rounded-md px-1.5 py-0.5 truncate"
                            style={{ background: style!.bg, color: style!.color, maxWidth: '7rem', fontSize: '0.7rem' }}
                            title={`${booking.guest} · ${booking.status}`}
                          >
                            {booking.guest.split(' ')[0]}
                          </span>
                        ) : (
                          <span style={{ color: '#3a2d50' }}>—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
