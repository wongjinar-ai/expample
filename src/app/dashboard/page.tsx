'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import TopTabBar, { type Tab } from '@/components/layout/TopTabBar'
import BookingModal from '@/components/bookings/BookingModal'
import { StatusBadge, CleanBadge, SourceBadge, ShiftBadge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, fmtMoney, calcNights, isStayingOn } from '@/lib/helpers'
import { ROOMS, OCC_ROOMS, ROOM_TYPES, SOURCES, CLEAN_STATUSES } from '@/lib/constants'
import type { Room, Status, CleanStatus, Source } from '@/lib/constants'

// ─── Shared types ──────────────────────────────────────────────────────────────

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
  cleaning_assigned_to?: string
  passport_url?: string
  passport_uploaded_at?: string
  passport_number?: string
  passport_name?: string
  guest_is_thai?: boolean
  guest2_passport_url?: string
  guest2_passport_uploaded_at?: string
  guest2_passport_number?: string
  guest2_passport_name?: string
  guest2_is_thai?: boolean
  tm30_url?: string
}

interface StaffMember {
  id: number
  name: string
  role: string
  shift: string
  mon?: string
  tue?: string
  wed?: string
  thu?: string
  fri?: string
  sat?: string
  sun?: string
}

// ─── Style constants ───────────────────────────────────────────────────────────

const TH: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--muted)',
  textAlign: 'left',
  padding: '7px 10px',
  borderBottom: '0.5px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
}

const TD: React.CSSProperties = {
  fontSize: '13px',
  padding: '8px 10px',
  borderBottom: '0.5px solid var(--border)',
  color: 'var(--text)',
}

const CARD: React.CSSProperties = {
  background: 'var(--bg)',
  border: '0.5px solid var(--border)',
  borderRadius: '8px',
  padding: '14px 16px',
  marginBottom: '1rem',
}

const SECTION_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '12px',
}

const METRIC_CARD: React.CSSProperties = {
  background: 'var(--surface)',
  borderRadius: '8px',
  padding: '12px 14px',
}

const INPUT_STYLE: React.CSSProperties = {
  fontSize: '13px',
  padding: '5px 10px',
  borderRadius: '6px',
  border: '0.5px solid var(--border2)',
  background: 'var(--bg)',
  color: 'var(--text)',
}

const ACTION_BTN: React.CSSProperties = {
  fontSize: '12px',
  padding: '6px 14px',
  borderRadius: '6px',
  border: '0.5px solid var(--border2)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().slice(0, 10)
}

function getDayName(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })
}

function initials(name: string): string {
  if (!name) return '?'
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

const MAX_CAP: Record<string, number> = {
  Standard: 2, Tent: 2, Bungalow: 3, Extra: 2,
}

// ─── DashboardTab ──────────────────────────────────────────────────────────────

function DashboardTab() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [editBooking, setEditBooking] = useState<Booking | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)
  const thisMonth = todayStr.slice(0, 7)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('*')
      .neq('status', 'Completed')
    setBookings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function openEdit(id: number) {
    const supabase = createClient()
    const { data } = await supabase.from('bookings').select('*').eq('id', id).single()
    if (data) setEditBooking(data as Booking)
  }

  if (loading) return <p style={{ color: 'var(--muted)', padding: '2rem' }}>Loading…</p>

  // Metric calculations
  const occupiedRooms = OCC_ROOMS.filter(room =>
    bookings.some(b => b.room === room && isStayingOn(b, todayStr))
  )
  const occupancyPct = Math.round((occupiedRooms.length / 10) * 100)
  const guestsToday = bookings
    .filter(b => isStayingOn(b, todayStr))
    .reduce((s, b) => s + (b.guests || 0), 0)
  const checkInsToday = bookings.filter(b => b.checkin === todayStr)
  const checkOutsToday = bookings.filter(b => b.checkout === todayStr)
  const activeBookings = bookings.filter(b => isStayingOn(b, todayStr))
  const grossTotal = activeBookings.reduce((s, b) => s + b.gross, 0)
  const commTotal = activeBookings.reduce((s, b) => s + b.comm, 0)
  const netTotal = grossTotal - commTotal

  // Weekly grid
  const monday = getMondayOfWeek(todayStr)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(monday, i)
    const occ = OCC_ROOMS.filter(room =>
      bookings.some(b => b.room === room && isStayingOn(b, dateStr))
    ).length
    return { dateStr, day: getDayName(dateStr), occ }
  })

  // Source breakdown
  const srcCount: Record<string, number> = { Direct: 0, 'Booking.com': 0, Agoda: 0, Airbnb: 0 }
  activeBookings.forEach(b => {
    if (b.source in srcCount) srcCount[b.source]++
  })

  // Cleaning summary
  const cleanCounts = {
    urgent: bookings.filter(b =>
      isStayingOn(b, todayStr) &&
      (b.status === 'Checkout' || b.checkin === todayStr) &&
      b.clean_status !== 'Clean'
    ).length,
    inProgress: bookings.filter(b => isStayingOn(b, todayStr) && b.clean_status === 'In Progress').length,
    done: bookings.filter(b => isStayingOn(b, todayStr) && b.clean_status === 'Clean').length,
    total: bookings.filter(b => isStayingOn(b, todayStr)).length,
  }

  // Upcoming (next 3 days)
  const upcoming = bookings
    .filter(b => b.checkin > todayStr && b.checkin <= addDays(todayStr, 3))
    .sort((a, b) => a.checkin.localeCompare(b.checkin))

  const metrics = [
    { label: 'Rooms occupied',  value: `${occupiedRooms.length}/10`, color: 'var(--blue)' },
    { label: 'Occupancy',       value: `${occupancyPct}%`,           color: 'var(--text)' },
    { label: 'Total guests',    value: String(guestsToday),           color: 'var(--green)' },
    { label: 'Check-out today', value: String(checkOutsToday.length), color: 'var(--amber)' },
    { label: 'Check-in today',  value: String(checkInsToday.length),  color: 'var(--green)' },
    { label: 'Net income',      value: fmtMoney(netTotal),            color: 'var(--teal)', small: true },
  ]

  const incomeRow = (label: string, value: string, color?: string, bold?: boolean) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
      <span style={{ fontSize: '13px', fontWeight: bold ? 500 : 400 }}>{label}</span>
      <span style={{ fontSize: '13px', fontWeight: bold ? 500 : 400, color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  )

  return (
    <>
      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '1.5rem' }}>
        {metrics.map(m => (
          <div key={m.label} style={METRIC_CARD}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: m.small ? '16px' : '20px', fontWeight: 500, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Check-out / Check-in today */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
        {/* Checking out */}
        <div style={{ ...CARD, borderLeft: '3px solid #BA7517', borderRadius: '0 8px 8px 0', marginBottom: 0 }}>
          <div style={{ ...SECTION_LABEL, color: '#BA7517' }}>Checking out today</div>
          {checkOutsToday.length === 0
            ? <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>No checkouts today</p>
            : checkOutsToday.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FAEEDA', color: '#633806', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 500, flexShrink: 0 }}>
                  {initials(b.guest)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.guest}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{b.room} · {b.type}</div>
                </div>
                <StatusBadge status={b.status as Status} />
              </div>
            ))}
        </div>

        {/* Checking in */}
        <div style={{ ...CARD, borderLeft: '3px solid #3B6D11', borderRadius: '0 8px 8px 0', marginBottom: 0 }}>
          <div style={{ ...SECTION_LABEL, color: '#3B6D11' }}>Checking in today</div>
          {checkInsToday.length === 0
            ? <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>No check-ins today</p>
            : checkInsToday.map(b => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EAF3DE', color: '#3B6D11', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 500, flexShrink: 0 }}>
                  {initials(b.guest)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 500 }}>{b.guest}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{b.room} · {b.type} · {b.guests} guest{b.guests !== 1 ? 's' : ''}</div>
                </div>
                <button
                  onClick={() => openEdit(b.id)}
                  style={{ ...ACTION_BTN, padding: '3px 8px', fontSize: '11px' }}
                >
                  Edit
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Upcoming check-ins */}
      {upcoming.length > 0 && (
        <div style={{ ...CARD }}>
          <div style={SECTION_LABEL}>Upcoming check-ins — next 3 days</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Guest', 'Room', 'Type', 'Guests', 'Check-in', 'Check-out', 'Source', 'Arriving'].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {upcoming.map(b => {
                  const daysUntil = Math.round((new Date(b.checkin + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
                  const arrivingLabel = daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : b.checkin
                  return (
                    <tr key={b.id} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={TD}>{b.guest}</td>
                      <td style={{ ...TD, fontWeight: 500 }}>{b.room}</td>
                      <td style={TD}>{b.type}</td>
                      <td style={TD}>{b.guests}</td>
                      <td style={TD}>{b.checkin}</td>
                      <td style={TD}>{b.checkout}</td>
                      <td style={TD}><SourceBadge source={b.source} /></td>
                      <td style={TD}><span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: daysUntil === 0 ? '#EAF3DE' : daysUntil === 1 ? '#FAEEDA' : '#F1EFE8', color: daysUntil === 0 ? '#27500A' : daysUntil === 1 ? '#633806' : '#444441' }}>{arrivingLabel}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Weekly grid + income summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
        <div style={CARD}>
          <div style={SECTION_LABEL}>Daily occupancy this week</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
            {weekDays.map(({ dateStr, day, occ }) => {
              const isToday = dateStr === todayStr
              return (
                <div key={dateStr} style={{ background: 'var(--bg)', border: `0.5px solid ${isToday ? '#378ADD' : 'var(--border)'}`, borderRadius: '6px', padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '3px' }}>{day}</div>
                  <div style={{ fontSize: '18px', fontWeight: 500, color: isToday ? '#185FA5' : 'var(--text)' }}>{occ}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{Math.round(occ / 10 * 100)}%</div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={CARD}>
          <div style={SECTION_LABEL}>Income summary</div>
          {incomeRow('Gross revenue', fmtMoney(grossTotal), '#3B6D11')}
          {incomeRow('OTA commission', `−${fmtMoney(commTotal)}`, '#A32D2D')}
          {incomeRow('Net income', fmtMoney(netTotal), '#185FA5', true)}
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
            {Object.entries(srcCount).map(([src, cnt]) => (
              <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '12px' }}>{src}</span>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{cnt} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>rm</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Occupancy by room dots */}
      <div style={CARD}>
        <div style={SECTION_LABEL}>Occupancy by room — each circle = 1 guest</div>
        {OCC_ROOMS.map(room => {
          const booking = bookings.find(b => b.room === room && isStayingOn(b, todayStr))
          const type = ROOM_TYPES[room as Room]
          const cap = MAX_CAP[type] ?? 2
          const guestCount = booking ? booking.guests : 0
          const isVacant = !booking
          const isCheckout = booking?.status === 'Checkout'
          const isCheckin = booking?.checkin === todayStr

          return (
            <div key={room} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
              <div style={{ fontSize: '13px', fontWeight: 500, width: '80px', flexShrink: 0 }}>{room}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', width: '54px', flexShrink: 0 }}>{type}</div>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1 }}>
                {Array.from({ length: cap }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: '13px', height: '13px', borderRadius: '50%', flexShrink: 0,
                      background: i < guestCount ? '#378ADD' : 'var(--surface)',
                      border: i < guestCount ? 'none' : '0.5px solid var(--border2)',
                    }}
                  />
                ))}
                <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: '6px' }}>
                  {isVacant
                    ? <em>Vacant</em>
                    : isCheckout
                    ? <span style={{ color: '#BA7517' }}>Checkout · {booking?.guest}</span>
                    : isCheckin
                    ? <span style={{ color: '#3B6D11' }}>Arriving · {booking?.guest}</span>
                    : `${guestCount} guest${guestCount !== 1 ? 's' : ''} · ${booking?.guest}`}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Cleaning + Shifts summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ ...CARD, marginBottom: 0 }}>
          <div style={SECTION_LABEL}>Cleaning status today</div>
          {[
            { label: 'Urgent / pending', value: `${cleanCounts.urgent} tasks`, color: '#A32D2D' },
            { label: 'In progress',      value: `${cleanCounts.inProgress} tasks`, color: '#BA7517' },
            { label: 'Completed',        value: `${cleanCounts.done} tasks`, color: '#3B6D11' },
            { label: 'Total today',      value: `${cleanCounts.total} tasks`, color: 'var(--text)', bold: true },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ fontSize: '13px' }}>{row.label}</span>
              <span style={{ fontSize: '13px', fontWeight: row.bold ? 500 : 400, color: row.color }}>{row.value}</span>
            </div>
          ))}
        </div>
        <div style={{ ...CARD, marginBottom: 0 }}>
          <div style={SECTION_LABEL}>Staff on shift today</div>
          <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
            View staff schedules in the Staff shifts tab.
          </p>
        </div>
      </div>

      {editBooking && (
        <BookingModal
          booking={editBooking as Booking & { id: number }}
          onClose={() => setEditBooking(null)}
          onSaved={() => { setEditBooking(null); load() }}
        />
      )}
    </>
  )
}

// ─── RoomsTab ──────────────────────────────────────────────────────────────────

function RoomsTab() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSource, setFilterSource] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Booking | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('bookings').select('*').order('checkin', { ascending: false })
    setBookings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Build rows: active bookings + vacant rooms
  const activeBookings = bookings.filter(b =>
    isStayingOn(b, todayStr) ||
    b.checkin === todayStr ||
    b.checkout === todayStr
  )

  const occupiedRoomNames = new Set(activeBookings.map(b => b.room))
  const vacantRooms = ROOMS.filter(r => !occupiedRoomNames.has(r))

  interface DisplayRow {
    id: number | null
    room: string
    type: string
    guests: number
    guest: string
    checkin: string
    checkout: string
    nights: number
    source: string
    pricePerNight: number
    status: string
    booking: Booking | null
  }

  const rows: DisplayRow[] = [
    ...activeBookings.map(b => ({
      id: b.id,
      room: b.room,
      type: b.type,
      guests: b.guests,
      guest: b.guest,
      checkin: b.checkin,
      checkout: b.checkout,
      nights: b.nights,
      source: b.source,
      pricePerNight: b.nights > 0 ? Math.round(b.gross / b.nights) : b.gross,
      status: b.status,
      booking: b,
    })),
    ...vacantRooms.map(r => ({
      id: null,
      room: r,
      type: ROOM_TYPES[r as Room],
      guests: 0,
      guest: '—',
      checkin: '—',
      checkout: '—',
      nights: 0,
      source: '—',
      pricePerNight: 0,
      status: 'Vacant',
      booking: null,
    })),
  ]

  const filteredRows = rows.filter(row => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'checkin') return row.checkin === todayStr
    if (filterStatus === 'checkout') return row.checkout === todayStr
    if (filterStatus === 'occupied') return row.status === 'Occupied'
    if (filterStatus === 'upcoming') return row.status === 'Upcoming'
    if (filterStatus === 'vacant') return row.status === 'Vacant'
    return true
  }).filter(row => {
    if (filterSource === 'all') return true
    return row.source === filterSource
  })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={INPUT_STYLE}>
          <option value="all">All rooms</option>
          <option value="checkin">Check-in today</option>
          <option value="occupied">Occupied</option>
          <option value="checkout">Checkout today</option>
          <option value="upcoming">Upcoming</option>
          <option value="vacant">Vacant</option>
        </select>
        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={INPUT_STYLE}>
          <option value="all">All sources</option>
          {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          style={{ ...ACTION_BTN, background: 'var(--text)', color: 'var(--bg)', border: 'none' }}
        >
          + New Booking
        </button>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              {['Room', 'Type', 'Guests', 'Guest name', 'Check-in', 'Check-out', 'Nights', 'Source', 'Price/night', 'Status'].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={10} style={{ ...TD, textAlign: 'center', color: 'var(--muted)' }}>Loading…</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={10} style={{ ...TD, textAlign: 'center', color: 'var(--muted)' }}>No rooms match your filters.</td></tr>
            ) : filteredRows.map(row => (
              <tr
                key={row.id ?? `vacant-${row.room}`}
                style={{ cursor: row.booking ? 'pointer' : 'default' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onClick={() => { if (row.booking) { setEditing(row.booking); setShowModal(true) } }}
              >
                <td style={{ ...TD, fontWeight: 500 }}>{row.room}</td>
                <td style={TD}>{row.type}</td>
                <td style={TD}>{row.guests > 0 ? row.guests : '—'}</td>
                <td style={TD}>{row.guest}</td>
                <td style={TD}>{row.checkin !== '—' ? fmtDate(row.checkin) : '—'}</td>
                <td style={TD}>{row.checkout !== '—' ? fmtDate(row.checkout) : '—'}</td>
                <td style={TD}>{row.nights > 0 ? row.nights : '—'}</td>
                <td style={TD}>{row.source !== '—' ? <SourceBadge source={row.source} /> : '—'}</td>
                <td style={TD}>{row.pricePerNight > 0 ? fmtMoney(row.pricePerNight) : '—'}</td>
                <td style={TD}>
                  {row.status === 'Vacant'
                    ? <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: '#F1EFE8', color: '#444441' }}>Vacant</span>
                    : <StatusBadge status={row.status as Status} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <BookingModal
          booking={editing ?? undefined}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
    </>
  )
}

// ─── IncomeTab ─────────────────────────────────────────────────────────────────

function IncomeTab() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('bookings').select('*').order('checkin', { ascending: false })
    setBookings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Build month options (past 12 months)
  const monthOptions: string[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    monthOptions.push(d.toISOString().slice(0, 7))
  }

  const filtered = bookings.filter(b => b.checkin.startsWith(selectedMonth))

  const grossTotal = filtered.reduce((s, b) => s + b.gross, 0)
  const commTotal = filtered.reduce((s, b) => s + b.comm, 0)
  const netTotal = filtered.reduce((s, b) => s + b.net_income, 0)
  const avgCommRate = grossTotal > 0 ? Math.round((commTotal / grossTotal) * 100) : 0

  const metrics = [
    { label: 'Gross revenue',   value: fmtMoney(grossTotal),  color: 'var(--green)' },
    { label: 'Commission',      value: fmtMoney(commTotal),   color: 'var(--red)' },
    { label: 'Net income',      value: fmtMoney(netTotal),    color: 'var(--blue)' },
    { label: 'Avg comm rate',   value: `${avgCommRate}%`,     color: 'var(--text)' },
  ]

  return (
    <>
      {/* Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '1.5rem' }}>
        {metrics.map(m => (
          <div key={m.label} style={METRIC_CARD}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{m.label}</div>
            <div style={{ fontSize: '20px', fontWeight: 500, color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Month selector + table */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={INPUT_STYLE}>
          {monthOptions.map(m => (
            <option key={m} value={m}>
              {new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </option>
          ))}
        </select>
      </div>

      <div style={CARD}>
        <div style={SECTION_LABEL}>Revenue breakdown per booking</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Room', 'Guest', 'Check-in', 'Check-out', 'Nights', 'Gross', 'Comm (฿)', 'Net income', 'Source'].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} style={{ ...TD, textAlign: 'center', color: 'var(--muted)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ ...TD, textAlign: 'center', color: 'var(--muted)' }}>No bookings for this month.</td></tr>
              ) : filtered.map(b => (
                <tr key={b.id}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...TD, fontWeight: 500 }}>{b.room}</td>
                  <td style={TD}>{b.guest}</td>
                  <td style={TD}>{fmtDate(b.checkin)}</td>
                  <td style={TD}>{fmtDate(b.checkout)}</td>
                  <td style={TD}>{b.nights}</td>
                  <td style={{ ...TD, color: 'var(--green)' }}>{fmtMoney(b.gross)}</td>
                  <td style={{ ...TD, color: 'var(--red)' }}>{b.comm > 0 ? `−${fmtMoney(b.comm)}` : '—'}</td>
                  <td style={{ ...TD, color: 'var(--blue)', fontWeight: 500 }}>{fmtMoney(b.net_income)}</td>
                  <td style={TD}><SourceBadge source={b.source} /></td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr style={{ background: 'var(--surface)', fontWeight: 500 }}>
                  <td style={{ ...TD, fontWeight: 600 }} colSpan={5}>Total — {filtered.length} booking{filtered.length !== 1 ? 's' : ''}</td>
                  <td style={{ ...TD, color: 'var(--green)', fontWeight: 600 }}>{fmtMoney(grossTotal)}</td>
                  <td style={{ ...TD, color: 'var(--red)', fontWeight: 600 }}>−{fmtMoney(commTotal)}</td>
                  <td style={{ ...TD, color: 'var(--blue)', fontWeight: 600 }}>{fmtMoney(netTotal)}</td>
                  <td style={TD} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── CleaningTab ───────────────────────────────────────────────────────────────

interface RoomCleanRow {
  room: string
  bookingId: number | null
  guest: string
  checkin: string
  checkout: string
  status: string
  clean_status: CleanStatus
  cleaningAssignedTo: string
}

function CleaningTab() {
  const [rooms, setRooms] = useState<RoomCleanRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [cleanFilter, setCleanFilter] = useState('all')

  const todayStr = new Date().toISOString().slice(0, 10)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: bookingsData } = await supabase
      .from('bookings')
      .select('id, room, guest, checkin, checkout, status, clean_status, cleaning_assigned_to')
      .in('status', ['Occupied', 'Check-in', 'Checkout', 'Upcoming'])
      .lte('checkin', todayStr)
      .gte('checkout', todayStr)

    const roomMap: Record<string, RoomCleanRow> = {}
    for (const r of ROOMS) {
      roomMap[r] = { room: r, bookingId: null, guest: '', checkin: '', checkout: '', status: '', clean_status: 'Needs Cleaning', cleaningAssignedTo: '' }
    }
    for (const b of bookingsData ?? []) {
      roomMap[b.room] = {
        room: b.room,
        bookingId: b.id,
        guest: b.guest,
        checkin: b.checkin,
        checkout: b.checkout,
        status: b.status,
        clean_status: b.clean_status as CleanStatus,
        cleaningAssignedTo: (b as Record<string, unknown>).cleaning_assigned_to as string ?? '',
      }
    }
    setRooms(ROOMS.map(r => roomMap[r]))
    setLoading(false)
  }, [todayStr])

  useEffect(() => { load() }, [load])

  async function updateCleanStatus(bookingId: number, room: string, newStatus: CleanStatus) {
    setSaving(room)
    const supabase = createClient()
    await supabase.from('bookings').update({ clean_status: newStatus }).eq('id', bookingId)
    setRooms(prev => prev.map(r => r.room === room ? { ...r, clean_status: newStatus } : r))
    setSaving(null)
  }

  function getTask(r: RoomCleanRow): string {
    if (!r.status) return 'Inspect'
    if (r.status === 'Checkout') return 'Full turnover clean'
    if (r.checkin === todayStr) return 'Prepare for arrival'
    if (r.status === 'Occupied') return 'Daily refresh'
    return 'Prepare for arrival'
  }

  function getPriority(r: RoomCleanRow): { label: string; color: string; bold: boolean } {
    if (!r.status) return { label: 'Low', color: '#3B6D11', bold: false }
    if (r.status === 'Checkout' || r.checkin === todayStr) return { label: 'Urgent', color: '#A32D2D', bold: true }
    return { label: 'Normal', color: 'var(--text)', bold: false }
  }

  const filteredRooms = rooms.filter(r => {
    if (cleanFilter === 'urgent') {
      const p = getPriority(r)
      return p.label === 'Urgent'
    }
    if (cleanFilter === 'pending') return r.clean_status === 'Needs Cleaning'
    if (cleanFilter === 'done') return r.clean_status === 'Clean'
    return true
  })

  const btnStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '20px',
    border: active ? 'none' : '0.5px solid var(--border2)',
    background: active ? '#1A1A19' : 'transparent',
    color: active ? '#FAFAF8' : 'var(--muted)',
    cursor: 'pointer',
    fontWeight: active ? 500 : 400,
  })

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <select value={cleanFilter} onChange={e => setCleanFilter(e.target.value)} style={INPUT_STYLE}>
          <option value="all">All tasks</option>
          <option value="urgent">Urgent first</option>
          <option value="pending">Pending only</option>
          <option value="done">Done</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surface)' }}>
              {['Room', 'Task', 'Assigned to', 'Priority', 'Status'].map(h => (
                <th key={h} style={TH}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', color: 'var(--muted)' }}>Loading…</td></tr>
            ) : filteredRooms.map(r => {
              const task = getTask(r)
              const priority = getPriority(r)
              return (
                <tr key={r.room}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...TD, fontWeight: 500 }}>{r.room}</td>
                  <td style={TD}>{task}</td>
                  <td style={{ ...TD, color: r.cleaningAssignedTo ? 'var(--text)' : 'var(--muted)' }}>{r.cleaningAssignedTo || '—'}</td>
                  <td style={{ ...TD, fontWeight: priority.bold ? 600 : 400, color: priority.color }}>
                    {priority.label === 'Urgent'
                      ? <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px', background: '#FCEBEB', color: '#791F1F' }}>Urgent</span>
                      : <span style={{ fontSize: '11px', color: priority.color }}>{priority.label}</span>}
                  </td>
                  <td style={TD}>
                    {r.bookingId ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {CLEAN_STATUSES.map(opt => (
                          <button
                            key={opt}
                            disabled={saving === r.room}
                            onClick={() => updateCleanStatus(r.bookingId!, r.room, opt)}
                            style={btnStyle(r.clean_status === opt)}
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
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

// ─── ShiftsTab ─────────────────────────────────────────────────────────────────

function ShiftsTab() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [shiftFilter, setShiftFilter] = useState('all')

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayDayName = new Date(todayStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' })
  const todayShortLower = todayDayName.slice(0, 3).toLowerCase() as keyof StaffMember

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase.from('staff').select('*').order('name')
      setStaff(data ?? [])
    } catch {
      setStaff([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const weekDayKeys: (keyof StaffMember)[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const weekDayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  const filteredStaff = staff.filter(s => {
    if (shiftFilter === 'all') return true
    return s.shift === shiftFilter
  })

  const todayStaff = staff.filter(s => {
    const todayShift = s[todayShortLower]
    return todayShift && todayShift !== 'Off'
  })

  if (loading) return <p style={{ color: 'var(--muted)', padding: '2rem' }}>Loading…</p>

  if (staff.length === 0) {
    return (
      <div style={CARD}>
        <p style={{ fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>No staff records yet.</p>
      </div>
    )
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <select value={shiftFilter} onChange={e => setShiftFilter(e.target.value)} style={INPUT_STYLE}>
          <option value="all">All shifts</option>
          <option value="Morning">Morning</option>
          <option value="Evening">Evening</option>
          <option value="Night">Night</option>
        </select>
      </div>

      {/* Today's shifts */}
      <div style={{ ...SECTION_LABEL, marginBottom: '10px' }}>Today — {todayDayName}</div>
      {todayStaff.length === 0 ? (
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '1rem' }}>No staff on shift today.</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', gap: '10px', marginBottom: '1rem' }}>
          {todayStaff.map(s => {
            const shiftName = s[todayShortLower] as string
            return (
              <div key={s.id} style={{ background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500 }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{s.role}</div>
                <ShiftBadge shift={shiftName} />
              </div>
            )
          })}
        </div>
      )}

      {/* Weekly rota */}
      <div style={CARD}>
        <div style={SECTION_LABEL}>Weekly rota</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                <th style={TH}>Name</th>
                <th style={TH}>Role</th>
                {weekDayLabels.map((d, i) => (
                  <th key={d} style={{ ...TH, color: weekDayKeys[i] === todayShortLower ? '#185FA5' : undefined }}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredStaff.map(s => (
                <tr key={s.id}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ ...TD, fontWeight: 500 }}>{s.name}</td>
                  <td style={{ ...TD, color: 'var(--muted)' }}>{s.role}</td>
                  {weekDayKeys.map(key => {
                    const val = s[key] as string | undefined
                    return (
                      <td key={String(key)} style={TD}>
                        {val && val !== 'Off'
                          ? <ShiftBadge shift={val} />
                          : <span style={{ fontSize: '12px', color: 'var(--muted2)' }}>Off</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

// ─── Root page (with useSearchParams — must be wrapped in Suspense) ─────────────

function DashboardPageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>(
    (searchParams.get('tab') as Tab) ?? 'dashboard'
  )

  function handleTabChange(tab: Tab) {
    setActiveTab(tab)
    router.replace(`/dashboard?tab=${tab}`, { scroll: false })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <TopTabBar activeTab={activeTab} onTabChange={handleTabChange} />
      <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'rooms'     && <RoomsTab />}
        {activeTab === 'income'    && <IncomeTab />}
        {activeTab === 'cleaning'  && <CleaningTab />}
        {activeTab === 'shifts'    && <ShiftsTab />}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--muted)' }}>Loading…</p>
      </div>
    }>
      <DashboardPageInner />
    </Suspense>
  )
}
