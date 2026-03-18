'use client'

import { useEffect, useState, useCallback } from 'react'
import AppShell from '@/components/layout/AppShell'
import BookingModal from '@/components/bookings/BookingModal'
import { StatusBadge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, fmtMoney } from '@/lib/helpers'
import { Status } from '@/lib/constants'

interface Booking {
  id: number
  guest: string
  guest2: string
  room: string
  type: string
  guests: number
  checkin: string
  checkout: string
  nights: number
  source: string
  gross: number
  comm: number
  net_income: number
  status: string
  clean_status: string
  special: string
  tm30: boolean
  booking_ref: string
  created_at: string
  updated_at: string
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSource, setFilterSource] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Booking | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .order('checkin', { ascending: false })
    setBookings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = bookings.filter(b => {
    const q = search.toLowerCase()
    const matchSearch = !q || b.guest.toLowerCase().includes(q) || b.room.toLowerCase().includes(q) || b.booking_ref.toLowerCase().includes(q)
    const matchStatus = !filterStatus || b.status === filterStatus
    const matchSource = !filterSource || b.source === filterSource
    return matchSearch && matchStatus && matchSource
  })

  const inputStyle = {
    background: 'var(--surface2)', color: 'var(--text)',
    border: '1px solid #3a2d50', borderRadius: '0.75rem',
    padding: '0.5rem 0.75rem', fontSize: '0.875rem',
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl" style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }}>
          Bookings
        </h2>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          + New Booking
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <input
          placeholder="Search guest, room, ref…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, minWidth: '200px' }}
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={inputStyle}>
          <option value="">All statuses</option>
          {['Upcoming', 'Check-in', 'Occupied', 'Checkout', 'Completed'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={inputStyle}>
          <option value="">All sources</option>
          {['Direct', 'Booking.com', 'Agoda', 'Airbnb', 'Other'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {(search || filterStatus || filterSource) && (
          <button
            onClick={() => { setSearch(''); setFilterStatus(''); setFilterSource('') }}
            style={{ color: 'var(--muted)', fontSize: '0.875rem' }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2e2040' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: 'var(--surface)', borderBottom: '1px solid #2e2040' }}>
              {['Guest', 'Room', 'Check-in', 'Check-out', 'Nights', 'Source', 'Gross', 'Net', 'Status', 'TM30'].map(h => (
                <th key={h} className="px-4 py-3 text-left" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)', fontSize: '0.7rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>Loading…</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>
                  {bookings.length === 0 ? 'No bookings yet. Add one above.' : 'No bookings match your filters.'}
                </td>
              </tr>
            ) : filtered.map((b, i) => (
              <tr
                key={b.id}
                onClick={() => { setEditing(b); setShowModal(true) }}
                className="cursor-pointer transition-colors"
                style={{
                  background: i % 2 === 0 ? 'var(--surface)' : 'transparent',
                  borderBottom: '1px solid #2e2040',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(75,0,165,0.15)')}
                onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'transparent')}
              >
                <td className="px-4 py-3" style={{ color: 'var(--text)' }}>
                  <div>{b.guest}</div>
                  {b.guest2 && <div style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>{b.guest2}</div>}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)' }}>{b.room}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>{fmtDate(b.checkin)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>{fmtDate(b.checkout)}</td>
                <td className="px-4 py-3 text-center" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)' }}>{b.nights}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{b.source}</td>
                <td className="px-4 py-3" style={{ color: 'var(--accent2)', fontFamily: 'var(--font-dm-mono)' }}>{fmtMoney(b.gross)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text)', fontFamily: 'var(--font-dm-mono)' }}>{fmtMoney(b.net_income)}</td>
                <td className="px-4 py-3"><StatusBadge status={b.status as Status} /></td>
                <td className="px-4 py-3 text-center" style={{ color: b.tm30 ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-dm-mono)' }}>
                  {b.tm30 ? '✓' : '✗'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <p className="mt-3 text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
          {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
          {' '}·{' '}
          Net total: {fmtMoney(filtered.reduce((s, b) => s + b.net_income, 0))}
        </p>
      )}

      {showModal && (
        <BookingModal
          booking={editing ?? undefined}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </AppShell>
  )
}
