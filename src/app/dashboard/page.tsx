'use client'

import { useEffect, useState } from 'react'
import AppShell from '@/components/layout/AppShell'
import { createClient } from '@/lib/supabase/client'
import { fmtMoney } from '@/lib/helpers'
import { OCC_ROOMS } from '@/lib/constants'

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

function shortDay(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

const CELL_COLORS: Record<string, { bg: string; color: string }> = {
  'Check-in':  { bg: 'rgba(74,222,128,0.25)',  color: '#4ade80' },
  'Occupied':  { bg: 'rgba(96,165,250,0.25)',  color: '#60a5fa' },
  'Checkout':  { bg: 'rgba(251,191,36,0.25)',  color: '#fbbf24' },
  'Upcoming':  { bg: 'rgba(96,165,250,0.15)',  color: '#60a5fa' },
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

  const occupiedToday = OCC_ROOMS.filter(room =>
    bookings.some(b => b.room === room && isOccupiedOn(b, today))
  )
  const occupancyPct = Math.round((occupiedToday.length / 10) * 100)
  const guestsToday = bookings.filter(b => isOccupiedOn(b, today)).reduce((s, b) => s + (b.guests || 0), 0)
  const checkInsToday = bookings.filter(b => b.checkin === today).length
  const checkOutsToday = bookings.filter(b => b.checkout === today).length
  const monthlyBookings = bookings.filter(b => b.checkin.startsWith(thisMonth))
  const grossMonth = monthlyBookings.reduce((s, b) => s + b.gross, 0)
  const netMonth = monthlyBookings.reduce((s, b) => s + b.net_income, 0)

  const upcoming = bookings
    .filter(b => b.checkin > today && b.checkin <= addDays(today, 7))
    .sort((a, b) => a.checkin.localeCompare(b.checkin))

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i))

  const metrics = [
    { label: 'Occupancy', value: `${occupancyPct}%`, sub: `${occupiedToday.length}/10 rooms`, color: 'var(--accent2)' },
    { label: 'Guests today', value: String(guestsToday), sub: 'in-house', color: 'var(--blue)' },
    { label: 'Check-ins', value: String(checkInsToday), sub: 'today', color: 'var(--green)' },
    { label: 'Checkouts', value: String(checkOutsToday), sub: 'today', color: 'var(--amber)' },
    { label: 'Gross', value: fmtMoney(grossMonth), sub: 'this month', color: 'var(--accent2)' },
    { label: 'Net', value: fmtMoney(netMonth), sub: 'this month', color: 'var(--green)' },
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
          {/* Metric Cards */}
          <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            {metrics.map(m => (
              <div key={m.label} className="rounded-2xl p-5" style={{ background: 'var(--surface)', border: '1px solid #2e2040' }}>
                <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>{m.label}</p>
                <p className="text-3xl font-semibold mb-1" style={{ color: m.color, fontFamily: 'var(--font-dm-mono)' }}>{m.value}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>{m.sub}</p>
              </div>
            ))}
          </div>

          {/* Weekly Occupancy Grid */}
          <div className="mb-8">
            <h3 className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
              Weekly Grid
            </h3>
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2e2040' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--surface)', borderBottom: '1px solid #2e2040' }}>
                    <th className="px-3 py-2 text-left" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)', minWidth: '6rem' }}>Room</th>
                    {days.map(d => (
                      <th key={d} className="px-2 py-2 text-center" style={{
                        color: d === today ? 'var(--accent2)' : 'var(--muted)',
                        fontFamily: 'var(--font-dm-mono)',
                        fontWeight: d === today ? 600 : 400,
                      }}>
                        {shortDay(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {OCC_ROOMS.map((room, i) => (
                    <tr key={room} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'transparent', borderBottom: '1px solid #2e2040' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)' }}>{room}</td>
                      {days.map(d => {
                        const booking = bookings.find(b => b.room === room && isOccupiedOn(b, d))
                        const style = booking ? (CELL_COLORS[booking.status] ?? { bg: 'rgba(96,165,250,0.15)', color: '#60a5fa' }) : null
                        return (
                          <td key={d} className="px-1 py-2 text-center">
                            {booking ? (
                              <span
                                className="inline-block rounded-md px-1.5 py-0.5 truncate"
                                style={{ background: style!.bg, color: style!.color, maxWidth: '5rem', fontSize: '0.65rem' }}
                                title={`${booking.guest} · ${booking.status}`}
                              >
                                {booking.guest.split(' ')[0]}
                              </span>
                            ) : (
                              <span style={{ color: '#3a2d50', fontSize: '0.6rem' }}>·</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Upcoming Check-ins */}
          <div>
            <h3 className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
              Upcoming Check-ins (next 7 days)
            </h3>
            {upcoming.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No upcoming check-ins in the next 7 days.</p>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2e2040' }}>
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: 'var(--surface)', borderBottom: '1px solid #2e2040' }}>
                      {['Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Source'].map(h => (
                        <th key={h} className="px-4 py-2 text-left" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {upcoming.map((b, i) => {
                      const nights = Math.round((new Date(b.checkout + 'T00:00:00').getTime() - new Date(b.checkin + 'T00:00:00').getTime()) / 86400000)
                      return (
                        <tr key={b.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'transparent', borderBottom: '1px solid #2e2040' }}>
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
