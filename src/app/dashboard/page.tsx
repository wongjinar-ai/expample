'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
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
  invoice_no?: string
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
  discount?: number
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

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Date-only overlap check — ignores booking status so grid shows all bookings
function isBookedOn(b: { checkin: string; checkout: string }, dateStr: string): boolean {
  return b.checkin <= dateStr && b.checkout > dateStr
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return localDateStr(d)
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
  const [newBookingDefaults, setNewBookingDefaults] = useState<{ room: string; checkin: string } | null>(null)
  const [gridStart, setGridStart] = useState(() => getMondayOfWeek(localDateStr(new Date())))

  const todayStr = localDateStr(new Date())
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
  const sundayStr = addDays(monday, 6)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dateStr = addDays(monday, i)
    const occ = OCC_ROOMS.filter(room =>
      bookings.some(b => b.room === room && isBookedOn(b, dateStr))
    ).length
    return { dateStr, day: getDayName(dateStr), occ }
  })

  // Week occupancy rate
  const weekOccRoomDays = weekDays.reduce((total, { occ }) => total + occ, 0)
  const weekOccPct = Math.round(weekOccRoomDays / 70 * 100)

  // Month occupancy rate (denominator = 300 per business rules)
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  let monthOccRoomDays = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${thisMonth}-${String(d).padStart(2, '0')}`
    monthOccRoomDays += OCC_ROOMS.filter(room =>
      bookings.some(b => b.room === room && isBookedOn(b, dayStr))
    ).length
  }
  const monthOccPct = Math.round(monthOccRoomDays / 300 * 100)

  // Weekly income (bookings checking in this week Mon–Sun)
  const weeklyBookings = bookings.filter(b => b.checkin >= monday && b.checkin <= sundayStr)
  const weekGross = weeklyBookings.reduce((s, b) => s + b.gross, 0)
  const weekComm  = weeklyBookings.reduce((s, b) => s + b.comm, 0)
  const weekNet   = weekGross - weekComm

  // Source breakdown (weekly)
  const srcCount: Record<string, number> = { Direct: 0, 'Booking.com': 0, Agoda: 0, Airbnb: 0 }
  weeklyBookings.forEach(b => {
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

      {/* Check-in / Check-out today — Check-in first */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
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
                <button onClick={() => openEdit(b.id)} style={{ ...ACTION_BTN, padding: '3px 8px', fontSize: '11px' }}>Edit</button>
              </div>
            ))}
        </div>

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

      {/* Weekly grid + weekly income summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1rem' }}>
        <div style={CARD}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <div style={SECTION_LABEL}>Occupancy this week</div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Week: <strong style={{ color: '#185FA5' }}>{weekOccPct}%</strong></span>
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Month: <strong style={{ color: '#185FA5' }}>{monthOccPct}%</strong></span>
            </div>
          </div>
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
          <div style={SECTION_LABEL}>Weekly income summary — {fmtDate(monday)} to {fmtDate(sundayStr)}</div>
          {incomeRow('Gross revenue', fmtMoney(weekGross), '#3B6D11')}
          {incomeRow('OTA commission', `−${fmtMoney(weekComm)}`, '#A32D2D')}
          {incomeRow('Net income', fmtMoney(weekNet), '#185FA5', true)}
          <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '8px', marginTop: '4px' }}>
            {Object.entries(srcCount).map(([src, cnt]) => (
              <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ fontSize: '12px' }}>{src}</span>
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{cnt} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>bk</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Occupancy by room — full week grid (scrollable calendar) */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              onClick={() => setGridStart(s => addDays(s, -7))}
              style={{ ...ACTION_BTN, padding: '4px 10px', fontSize: '14px', lineHeight: 1 }}
            >‹</button>
            <button
              onClick={() => setGridStart(s => addDays(s, 7))}
              style={{ ...ACTION_BTN, padding: '4px 10px', fontSize: '14px', lineHeight: 1 }}
            >›</button>
          </div>
          <input
            type="date"
            value={gridStart}
            onChange={e => e.target.value && setGridStart(e.target.value)}
            style={{ ...INPUT_STYLE, fontSize: '12px', padding: '4px 8px' }}
          />
          <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '2px' }}>
            {fmtDate(gridStart)} — {fmtDate(addDays(gridStart, 6))}
          </span>
          {gridStart !== getMondayOfWeek(todayStr) && (
            <button
              onClick={() => setGridStart(getMondayOfWeek(todayStr))}
              style={{ ...ACTION_BTN, padding: '3px 8px', fontSize: '11px', marginLeft: 'auto' }}
            >Today</button>
          )}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ ...TH, width: '80px', textAlign: 'left' }}>Room</th>
                <th style={{ ...TH, width: '52px', textAlign: 'left' }}>Type</th>
                {Array.from({ length: 7 }, (_, i) => addDays(gridStart, i)).map(dateStr => {
                  const day = getDayName(dateStr)
                  return (
                    <th key={dateStr} style={{ ...TH, textAlign: 'center', background: dateStr === todayStr ? '#EFF6FF' : undefined }}>
                      <div style={{ fontWeight: 500 }}>{day}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 400 }}>{dateStr.slice(5)}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {OCC_ROOMS.map(room => (
                <tr key={room} onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ ...TD, fontWeight: 500 }}>{room}</td>
                  <td style={{ ...TD, color: 'var(--muted)', fontSize: '11px' }}>{ROOM_TYPES[room as Room]}</td>
                  {Array.from({ length: 7 }, (_, i) => addDays(gridStart, i)).map(dateStr => {
                    const b = bookings.find(bk => bk.room === room && isBookedOn(bk, dateStr))
                    const isToday = dateStr === todayStr
                    const isCheckout = b ? addDays(dateStr, 1) === b.checkout : false
                    const isCheckin = b?.checkin === dateStr
                    const cellBg = !b ? undefined
                      : isCheckout ? '#FEF3C7'
                      : isCheckin  ? '#DCFCE7'
                      : '#DBEAFE'
                    const cellColor = !b ? 'var(--muted)'
                      : isCheckout ? '#92400E'
                      : isCheckin  ? '#166534'
                      : '#1E40AF'
                    const shortName = b ? (b.guest.length > 6 ? b.guest.slice(0, 6) + '…' : b.guest) : ''
                    return (
                      <td key={dateStr} style={{ ...TD, textAlign: 'center', padding: '4px 3px', background: isToday ? '#EFF6FF' : undefined }}>
                        {b ? (
                          <div style={{ background: cellBg, color: cellColor, borderRadius: '4px', padding: '3px 4px', fontSize: '10px', fontWeight: 500, lineHeight: 1.4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cellColor, display: 'inline-block', flexShrink: 0 }} />
                              <span>{b.guests ?? 1}</span>
                            </div>
                            <div style={{ fontSize: '9px', overflow: 'hidden', whiteSpace: 'nowrap' }}>{shortName}</div>
                          </div>
                        ) : (
                          <div
                            onClick={() => setNewBookingDefaults({ room, checkin: dateStr })}
                            style={{ width: '100%', height: '34px', borderRadius: '4px', background: 'var(--bg)', border: '0.5px solid var(--border)', cursor: 'pointer' }}
                            title={`Add booking for ${room} on ${dateStr}`}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '1.5px solid var(--border)' }}>
                <td colSpan={2} style={{ ...TD, fontWeight: 600, fontSize: '11px', color: 'var(--muted)' }}>Total guests</td>
                {Array.from({ length: 7 }, (_, i) => addDays(gridStart, i)).map(dateStr => {
                  const total = bookings
                    .filter(b => isBookedOn(b, dateStr))
                    .reduce((sum, b) => sum + (b.guests || 1), 0)
                  const isToday = dateStr === todayStr
                  return (
                    <td key={dateStr} style={{ ...TD, textAlign: 'center', fontWeight: 700, fontSize: '12px', color: total > 0 ? '#1E40AF' : 'var(--muted)', background: isToday ? '#EFF6FF' : undefined }}>
                      {total > 0 ? total : '—'}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        </div>
        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
          {[
            { bg: '#DBEAFE', color: '#1E40AF', label: 'Occupied' },
            { bg: '#DCFCE7', color: '#166534', label: 'Check-in' },
            { bg: '#FEF3C7', color: '#92400E', label: 'Checkout' },
          ].map(({ bg, color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: bg }} />
              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{label}</span>
            </div>
          ))}
        </div>
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

      {newBookingDefaults && (
        <BookingModal
          defaults={{ room: newBookingDefaults.room, type: ROOM_TYPES[newBookingDefaults.room as Room], checkin: newBookingDefaults.checkin }}
          onClose={() => setNewBookingDefaults(null)}
          onSaved={() => { setNewBookingDefaults(null); load() }}
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

  const todayStr = localDateStr(new Date())

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
  const now = new Date()
  const [selectedMonthNum, setSelectedMonthNum] = useState(() => now.getMonth() + 1)
  const [selectedYear, setSelectedYear]         = useState(() => now.getFullYear())
  const [editing, setEditing] = useState<Booking | null>(null)

  const selectedMonth = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('bookings').select('*').order('checkin', { ascending: false })
    setBookings(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  // Years: 3 years back up to next year
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 3 + i)

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

      {/* Month + Year selectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1rem' }}>
        <select value={selectedMonthNum} onChange={e => setSelectedMonthNum(Number(e.target.value))} style={INPUT_STYLE}>
          {MONTHS.map((name, i) => (
            <option key={i + 1} value={i + 1}>{name}</option>
          ))}
        </select>
        <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={INPUT_STYLE}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div style={CARD}>
        <div style={SECTION_LABEL}>Revenue breakdown per booking</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Room', 'Guest', 'Check-in', 'Check-out', 'Nights', 'Gross', 'Comm (฿)', 'Net income', 'Source', ''].map(h => (
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
                  <td style={{ ...TD, textAlign: 'right' }}>
                    <button
                      onClick={() => setEditing(b)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '0.9rem', padding: '2px 4px', borderRadius: '4px' }}
                      title="Edit booking"
                    >✏️</button>
                  </td>
                </tr>
              ))}
              {filtered.length > 0 && (
                <tr style={{ background: 'var(--surface)', fontWeight: 500 }}>
                  <td style={{ ...TD, fontWeight: 600 }} colSpan={5}>Total — {filtered.length} booking{filtered.length !== 1 ? 's' : ''}</td>
                  <td style={{ ...TD, color: 'var(--green)', fontWeight: 600 }}>{fmtMoney(grossTotal)}</td>
                  <td style={{ ...TD, color: 'var(--red)', fontWeight: 600 }}>−{fmtMoney(commTotal)}</td>
                  <td style={{ ...TD, color: 'var(--blue)', fontWeight: 600 }}>{fmtMoney(netTotal)}</td>
                  <td style={TD} colSpan={2} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <BookingModal
          booking={editing as Booking & { id: number }}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load() }}
        />
      )}
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

  const todayStr = localDateStr(new Date())

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

  const todayStr = localDateStr(new Date())
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

// ─── AccountsTab ───────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'Food & Beverage',
  'Utilities',
  'Maintenance & Repair',
  'Cleaning Supplies',
  'Staff & Wages',
  'Marketing',
  'Transport',
  'Equipment',
  'Other',
] as const

const EXPENSE_BUCKET = 'expense-receipts'

// Convert any image (including HEIC) to a JPEG Blob via canvas.
// createImageBitmap natively supports HEIC on macOS Chrome 118+.
async function toJpegBlob(file: File): Promise<{ blob: Blob; ext: string }> {
  const isHEIC = /heic|heif/i.test(file.type + file.name)
  if (!isHEIC && !file.type.startsWith('image/')) return { blob: file, ext: file.name.split('.').pop() ?? 'bin' }
  const MAX = 2000
  const bitmap = await createImageBitmap(file)
  let { width: w, height: h } = bitmap
  if (w > MAX || h > MAX) {
    if (w > h) { h = Math.round(h * MAX / w); w = MAX } else { w = Math.round(w * MAX / h); h = MAX }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise(resolve => canvas.toBlob(blob => resolve({ blob: blob!, ext: 'jpg' }), 'image/jpeg', 0.88))
}

interface Expense {
  id: number
  date: string
  category: string
  description: string
  amount: number
  paid_by: string
  receipt_url?: string
  notes: string
  created_at: string
}

const EXPENSE_EMPTY = {
  date: localDateStr(new Date()),
  category: EXPENSE_CATEGORIES[0] as string,
  description: '',
  amount: 0,
  paid_by: 'Cash',
  receipt_url: '',
  notes: '',
}

// ── ExpenseModal ──────────────────────────────────────────────────────────────

interface ExpenseModalProps {
  expense?: Expense
  onClose: () => void
  onSaved: () => void
}

function ExpenseModal({ expense, onClose, onSaved }: ExpenseModalProps) {
  const [form, setForm] = useState({ ...EXPENSE_EMPTY, ...(expense ?? {}) })
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function set<K extends keyof typeof EXPENSE_EMPTY>(key: K, value: (typeof EXPENSE_EMPTY)[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function viewReceipt() {
    if (!expense?.receipt_url) return
    const supabase = createClient()
    const { data } = await supabase.storage.from(EXPENSE_BUCKET).createSignedUrl(expense.receipt_url, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function handleSave() {
    if (!form.description.trim()) { setError('Description is required'); return }
    if (!form.date) { setError('Date is required'); return }
    if (form.amount <= 0) { setError('Amount must be greater than 0'); return }
    setSaving(true)
    setError('')
    const supabase = createClient()

    if (expense?.id) {
      // Update
      const { error: err } = await supabase.from('expenses').update({
        date: form.date, category: form.category, description: form.description,
        amount: form.amount, paid_by: form.paid_by, notes: form.notes,
        updated_at: new Date().toISOString(),
      }).eq('id', expense.id)
      if (err) { setError(err.message); setSaving(false); return }

      if (receiptFile) {
        const { blob, ext } = await toJpegBlob(receiptFile)
        const path = `${expense.id}/receipt.${ext}`
        await supabase.storage.from(EXPENSE_BUCKET).upload(path, blob, { upsert: true, contentType: ext === 'jpg' ? 'image/jpeg' : receiptFile.type })
        await supabase.from('expenses').update({ receipt_url: path }).eq('id', expense.id)
      }
    } else {
      // Insert
      const { data: inserted, error: err } = await supabase.from('expenses').insert({
        date: form.date, category: form.category, description: form.description,
        amount: form.amount, paid_by: form.paid_by, notes: form.notes,
      }).select().single()
      if (err || !inserted) { setError(err?.message ?? 'Insert failed'); setSaving(false); return }

      if (receiptFile) {
        const { blob, ext } = await toJpegBlob(receiptFile)
        const path = `${inserted.id}/receipt.${ext}`
        await supabase.storage.from(EXPENSE_BUCKET).upload(path, blob, { upsert: true, contentType: ext === 'jpg' ? 'image/jpeg' : receiptFile.type })
        await supabase.from('expenses').update({ receipt_url: path }).eq('id', inserted.id)
      }
    }

    onSaved()
  }

  async function handleDelete() {
    if (!expense?.id) return
    if (!confirm('Delete this expense?')) return
    const supabase = createClient()
    if (expense.receipt_url) {
      await supabase.storage.from(EXPENSE_BUCKET).remove([expense.receipt_url])
    }
    await supabase.from('expenses').delete().eq('id', expense.id)
    onSaved()
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  }
  const modalStyle: React.CSSProperties = {
    background: 'var(--surface)', border: '0.5px solid var(--border)',
    borderRadius: '12px', padding: '24px', width: '480px', maxWidth: '95vw',
    maxHeight: '90vh', overflowY: 'auto',
  }
  const labelStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--muted)', marginBottom: '4px', display: 'block' }
  const inputStyle: React.CSSProperties = {
    ...INPUT_STYLE, width: '100%', boxSizing: 'border-box',
  }
  const rowStyle: React.CSSProperties = { marginBottom: '14px' }

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 500, margin: 0 }}>{expense?.id ? 'Edit Expense' : 'New Expense'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
        </div>

        {error && <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '14px' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={rowStyle}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={inputStyle}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="e.g. Breakfast ingredients" style={inputStyle} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={rowStyle}>
            <label style={labelStyle}>Amount (฿)</label>
            <input type="number" min={0} value={form.amount || ''} onChange={e => set('amount', Number(e.target.value))} placeholder="0" style={inputStyle} />
          </div>
          <div style={rowStyle}>
            <label style={labelStyle}>Paid by</label>
            <input value={form.paid_by} onChange={e => set('paid_by', e.target.value)} placeholder="Cash / Card / Name" style={inputStyle} />
          </div>
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder="Any additional details…" style={{ ...inputStyle, resize: 'vertical' }} />
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>Receipt</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={{ ...ACTION_BTN, fontSize: '12px', padding: '5px 12px' }}>
              {receiptFile ? `✓ ${receiptFile.name.slice(0, 22)}` : expense?.receipt_url ? '📷 Replace receipt' : '📷 Upload receipt'}
            </button>
            {expense?.receipt_url && !receiptFile && (
              <button type="button" onClick={viewReceipt} style={{ ...ACTION_BTN, fontSize: '12px', padding: '5px 12px', color: '#185FA5' }}>View</button>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => setReceiptFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '0.5px solid var(--border)' }}>
          {expense?.id
            ? <button onClick={handleDelete} style={{ ...ACTION_BTN, color: '#A32D2D', borderColor: '#A32D2D', fontSize: '12px', padding: '6px 14px' }}>Delete</button>
            : <span />
          }
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ ...ACTION_BTN, fontSize: '12px', padding: '6px 14px' }}>Cancel</button>
            <button onClick={handleSave} disabled={saving} style={{ ...ACTION_BTN, background: saving ? 'var(--surface2)' : '#1E40AF', color: '#fff', borderColor: '#1E40AF', fontSize: '12px', padding: '6px 16px' }}>
              {saving ? 'Saving…' : expense?.id ? 'Save Changes' : 'Add Expense'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AccountsTab() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [catFilter, setCatFilter] = useState('all')

  const now = new Date()
  const [selectedMonthNum, setSelectedMonthNum] = useState(() => now.getMonth() + 1)
  const [selectedYear, setSelectedYear] = useState(() => now.getFullYear())

  const selectedMonth = `${selectedYear}-${String(selectedMonthNum).padStart(2, '0')}`

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from('expenses').select('*').order('date', { ascending: false })
    setExpenses(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  const filtered = expenses.filter(e => e.date.startsWith(selectedMonth) && (catFilter === 'all' || e.category === catFilter))
  const totalAmount = filtered.reduce((s, e) => s + e.amount, 0)

  // Category breakdown (all in month, unaffected by catFilter)
  const monthExpenses = expenses.filter(e => e.date.startsWith(selectedMonth))
  const byCat: Record<string, number> = {}
  for (const e of monthExpenses) byCat[e.category] = (byCat[e.category] ?? 0) + e.amount
  const topCats = Object.entries(byCat).sort((a, b) => b[1] - a[1])

  const CAT_COLORS: Record<string, string> = {
    'Food & Beverage': '#166534',
    'Utilities': '#1E40AF',
    'Maintenance & Repair': '#92400E',
    'Cleaning Supplies': '#065F46',
    'Staff & Wages': '#6B21A8',
    'Marketing': '#B45309',
    'Transport': '#0F766E',
    'Equipment': '#9F1239',
    'Other': '#374151',
  }

  return (
    <>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select value={selectedMonthNum} onChange={e => setSelectedMonthNum(Number(e.target.value))} style={INPUT_STYLE}>
            {MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={INPUT_STYLE}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={INPUT_STYLE}>
            <option value="all">All categories</option>
            {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button
          onClick={() => { setEditing(null); setShowModal(true) }}
          style={{ ...ACTION_BTN, background: '#1E40AF', color: '#fff', borderColor: '#1E40AF', padding: '7px 16px', fontSize: '13px' }}
        >+ Add Expense</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px,1fr))', gap: '10px', marginBottom: '1.5rem' }}>
        <div style={METRIC_CARD}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Total expenses</div>
          <div style={{ fontSize: '20px', fontWeight: 500, color: '#A32D2D' }}>{fmtMoney(monthExpenses.reduce((s, e) => s + e.amount, 0))}</div>
        </div>
        <div style={METRIC_CARD}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>Transactions</div>
          <div style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)' }}>{monthExpenses.length}</div>
        </div>
        {topCats.slice(0, 3).map(([cat, amt]) => (
          <div key={cat} style={METRIC_CARD}>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{cat}</div>
            <div style={{ fontSize: '18px', fontWeight: 500, color: CAT_COLORS[cat] ?? 'var(--text)' }}>{fmtMoney(amt)}</div>
          </div>
        ))}
      </div>

      {/* Category breakdown bar */}
      {topCats.length > 0 && (
        <div style={{ ...CARD, marginBottom: '1rem' }}>
          <div style={SECTION_LABEL}>Breakdown — {MONTHS[selectedMonthNum - 1]} {selectedYear}</div>
          {topCats.map(([cat, amt]) => {
            const pct = Math.round((amt / monthExpenses.reduce((s, e) => s + e.amount, 0)) * 100)
            return (
              <div key={cat} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '3px' }}>
                  <span>{cat}</span>
                  <span style={{ fontWeight: 500 }}>{fmtMoney(amt)} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({pct}%)</span></span>
                </div>
                <div style={{ height: '4px', background: 'var(--surface2)', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: CAT_COLORS[cat] ?? '#374151', borderRadius: '2px' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Expense table */}
      <div style={CARD}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
          <div style={SECTION_LABEL}>Expenses — {filtered.length} record{filtered.length !== 1 ? 's' : ''}</div>
          {catFilter !== 'all' && <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Total: <strong style={{ color: '#A32D2D' }}>{fmtMoney(totalAmount)}</strong></span>}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface)' }}>
                {['Date', 'Category', 'Description', 'Amount', 'Paid by', 'Receipt', 'Notes', ''].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ ...TD, textAlign: 'center', color: 'var(--muted)' }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ ...TD, textAlign: 'center', color: 'var(--muted)', fontStyle: 'italic' }}>No expenses this month.</td></tr>
              ) : filtered.map(e => (
                <tr key={e.id}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--surface)')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}
                  onClick={() => { setEditing(e); setShowModal(true) }}
                >
                  <td style={TD}>{fmtDate(e.date)}</td>
                  <td style={TD}><span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '20px', background: 'var(--surface2)', color: CAT_COLORS[e.category] ?? 'var(--text)' }}>{e.category}</span></td>
                  <td style={TD}>{e.description}</td>
                  <td style={{ ...TD, fontWeight: 500, color: '#A32D2D' }}>{fmtMoney(e.amount)}</td>
                  <td style={{ ...TD, color: 'var(--muted)' }}>{e.paid_by}</td>
                  <td style={TD}>{e.receipt_url ? <span style={{ fontSize: '11px', color: '#185FA5' }}>📷</span> : <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>}</td>
                  <td style={{ ...TD, color: 'var(--muted)', fontSize: '12px', maxWidth: '160px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{e.notes || '—'}</td>
                  <td style={TD}><button onClick={ev => { ev.stopPropagation(); setEditing(e); setShowModal(true) }} style={{ ...ACTION_BTN, padding: '3px 10px', fontSize: '11px' }}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <ExpenseModal
          expense={editing ?? undefined}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSaved={() => { setShowModal(false); setEditing(null); load() }}
        />
      )}
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
        {activeTab === 'accounts'  && <AccountsTab />}
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
