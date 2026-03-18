'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import { CleanBadge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { ROOMS } from '@/lib/constants'
import { CleanStatus } from '@/lib/constants'

interface RoomStatus {
  room: string
  bookingId: number | null
  guest: string
  checkin: string
  checkout: string
  status: string
  clean_status: CleanStatus
}

const CLEAN_OPTIONS: CleanStatus[] = ['Needs Cleaning', 'In Progress', 'Clean']

export default function CleaningPage() {
  const [rooms, setRooms] = useState<RoomStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: bookings } = await supabase
      .from('bookings')
      .select('id, room, guest, checkin, checkout, status, clean_status')
      .in('status', ['Occupied', 'Check-in', 'Checkout', 'Upcoming'])
      .lte('checkin', today)
      .gte('checkout', today)

    const roomMap: Record<string, RoomStatus> = {}
    for (const r of ROOMS) {
      roomMap[r] = { room: r, bookingId: null, guest: '', checkin: '', checkout: '', status: '', clean_status: 'Needs Cleaning' }
    }
    for (const b of bookings ?? []) {
      roomMap[b.room] = {
        room: b.room,
        bookingId: b.id,
        guest: b.guest,
        checkin: b.checkin,
        checkout: b.checkout,
        status: b.status,
        clean_status: b.clean_status as CleanStatus,
      }
    }
    setRooms(ROOMS.map(r => roomMap[r]))
    setLoading(false)
  }, [today])

  useEffect(() => { load() }, [load])

  async function updateCleanStatus(bookingId: number, room: string, newStatus: CleanStatus) {
    setSaving(room)
    const supabase = createClient()
    await supabase.from('bookings').update({ clean_status: newStatus }).eq('id', bookingId)
    setRooms(prev => prev.map(r => r.room === room ? { ...r, clean_status: newStatus } : r))
    setSaving(null)
  }

  const inputStyle = (active: boolean) => ({
    background: active ? 'var(--surface2)' : 'transparent',
    color: 'var(--text)',
    border: '1px solid #3a2d50',
    borderRadius: '0.625rem',
    padding: '0.35rem 0.6rem',
    fontSize: '0.8rem',
    fontFamily: 'var(--font-dm-mono)',
    cursor: 'pointer',
    opacity: active ? 1 : 0.5,
  })

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl" style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }}>
          Cleaning Plan
        </h2>
        <p className="text-sm" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}
        </p>
      </div>

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2e2040' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '1px solid #2e2040' }}>
                {['Room', 'Guest', 'Check-in', 'Check-out', 'Booking Status', 'Clean Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rooms.map((r, i) => (
                <tr
                  key={r.room}
                  style={{
                    background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                    borderBottom: '1px solid #2e2040',
                  }}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)' }}>{r.room}</td>
                  <td className="px-4 py-3" style={{ color: r.guest ? 'var(--text)' : 'var(--muted)' }}>
                    {r.guest || '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
                    {r.checkin || '—'}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
                    {r.checkout || '—'}
                  </td>
                  <td className="px-4 py-3">
                    {r.status ? (
                      <span style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.8rem' }}>{r.status}</span>
                    ) : (
                      <span style={{ color: 'var(--surface2)', fontSize: '0.8rem' }}>Vacant</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.bookingId ? (
                      <div className="flex items-center gap-2">
                        {CLEAN_OPTIONS.map(opt => (
                          <button
                            key={opt}
                            disabled={saving === r.room}
                            onClick={() => updateCleanStatus(r.bookingId!, r.room, opt)}
                            style={inputStyle(r.clean_status === opt)}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <CleanBadge status="Clean" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  )
}
