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
import { TASKS, timeToSlot, SLOT_LABELS } from '@/app/staff/tasks'
import type { Assignee, Task, SlotType } from '@/app/staff/tasks'
import { DEFAULT_RECIPES } from '@/app/staff/recipes'
import type { Recipe } from '@/app/staff/recipes'

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

// ─── ShiftsTab — Weekly Task Planner ──────────────────────────────────────────

type ShiftRole = 'KTC' | 'ACF' | 'GM' | 'CEO'
const ALL_ASSIGNEES: Assignee[] = ['KTC', 'ACF', 'GM', 'CEO', 'Anyone Free', 'All Staff', '-']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const SECTIONS = ['Accommodation & Farm', 'Kitchen', 'Office'] as const
const SHIFT_ROLES: ShiftRole[] = ['KTC', 'ACF', 'GM', 'CEO']
const SHIFT_ROLE_NAMES: Record<ShiftRole, string> = { KTC: 'Kitchen Staff', ACF: 'Wan', GM: 'General Manager', CEO: 'Co-Owner' }
const TASK_VIDEO_BUCKET = 'booking-docs'

function getWeekMonday(): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return localDateStr(d)
}

function addDaysLocal(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return localDateStr(d)
}

function fmtShortDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function overrideKey(weekStart: string, taskIdx: number, dayIdx: number): string {
  return `${weekStart}_${taskIdx}_${dayIdx}`
}

type TaskStatusVal = 'pending' | 'done' | 'skipped' | 'na'

interface TaskSubmission {
  id: string
  taskIdx: number
  taskName: string
  weekStart: string
  dayIdx: number
  role: ShiftRole
  videoPath: string
  submittedAt: string
  reviewStatus: 'pending' | 'approved' | 'rejected'
  reviewNote: string
}

interface CustomTask {
  id: string
  name: string
  section: 'Accommodation & Farm' | 'Kitchen' | 'Office'
  time: string
  slot: SlotType
  noDeadline: boolean
  instructions: string[]
  days: [Assignee, Assignee, Assignee, Assignee, Assignee, Assignee, Assignee]
}

interface HimmapunState {
  weekStart?: string
  taskOverrides?: Record<string, Assignee>
  taskStatus?: Record<string, TaskStatusVal>
  taskSubmissions?: TaskSubmission[]
  customTasks?: CustomTask[]
  cookbookRecipes?: Recipe[]
  taskRecipeLinks?: Record<string, string[]>  // key: taskIdx string, value: recipe IDs
}

function loadHimmapunState(): HimmapunState {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem('himmapun_state')
    return raw ? JSON.parse(raw) as HimmapunState : {}
  } catch { return {} }
}

function saveHimmapunPatch(patch: Partial<HimmapunState>) {
  try {
    const current = loadHimmapunState()
    localStorage.setItem('himmapun_state', JSON.stringify({ ...current, ...patch }))
  } catch { /* ignore */ }
}

function loadTaskOverrides(): Record<string, Assignee> {
  return loadHimmapunState().taskOverrides ?? {}
}

function saveTaskOverrides(overrides: Record<string, Assignee>) {
  saveHimmapunPatch({ taskOverrides: overrides })
}

function loadCookbookRecipes(): Recipe[] {
  const state = loadHimmapunState()
  if (!state.cookbookRecipes) {
    saveHimmapunPatch({ cookbookRecipes: DEFAULT_RECIPES })
    return DEFAULT_RECIPES
  }
  return state.cookbookRecipes
}

function saveCookbookRecipes(recipes: Recipe[]) {
  saveHimmapunPatch({ cookbookRecipes: recipes })
}

function loadTaskRecipeLinks(): Record<string, string[]> {
  return loadHimmapunState().taskRecipeLinks ?? {}
}

function saveTaskRecipeLinks(links: Record<string, string[]>) {
  saveHimmapunPatch({ taskRecipeLinks: links })
}

function getAssigneeForCell(overrides: Record<string, Assignee>, weekStart: string, taskIdx: number, dayIdx: number, fallback?: Assignee): Assignee {
  return overrides[overrideKey(weekStart, taskIdx, dayIdx)] ?? fallback ?? '-'
}

function isVisibleToRole(assignee: Assignee, role: ShiftRole): boolean {
  if (assignee === '-') return false
  if (assignee === 'Anyone Free' || assignee === 'All Staff') return role !== 'CEO'
  return assignee === role
}

function roleColor(role: ShiftRole): { bg: string; color: string; border: string } {
  if (role === 'KTC') return { bg: 'rgba(13,70,140,0.18)',  color: '#60a5fa', border: 'rgba(96,165,250,0.4)' }
  if (role === 'ACF') return { bg: 'rgba(34,100,60,0.22)',  color: '#4ade80', border: 'rgba(74,222,128,0.4)' }
  if (role === 'GM')  return { bg: 'rgba(8,80,65,0.22)',    color: '#2dd4bf', border: 'rgba(45,212,191,0.4)' }
  return                      { bg: 'rgba(90,70,220,0.18)', color: '#a78bfa', border: 'rgba(167,139,250,0.4)' }
}

function assigneeBadgeStyle(a: Assignee): { bg: string; color: string; border: string } {
  if (a === 'KTC')         return { bg: 'rgba(13,70,140,0.18)',   color: '#60a5fa', border: 'rgba(96,165,250,0.3)' }
  if (a === 'ACF')         return { bg: 'rgba(34,100,60,0.22)',   color: '#4ade80', border: 'rgba(74,222,128,0.3)' }
  if (a === 'GM')          return { bg: 'rgba(8,80,65,0.22)',     color: '#2dd4bf', border: 'rgba(45,212,191,0.3)' }
  if (a === 'CEO')         return { bg: 'rgba(90,70,220,0.18)',   color: '#a78bfa', border: 'rgba(167,139,250,0.3)' }
  if (a === 'Anyone Free') return { bg: 'rgba(180,130,0,0.18)',   color: '#fbbf24', border: 'rgba(251,191,36,0.3)' }
  if (a === 'All Staff')   return { bg: 'rgba(220,100,30,0.18)',  color: '#fb923c', border: 'rgba(251,146,60,0.3)' }
  return { bg: 'transparent', color: 'var(--muted)', border: 'transparent' }
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────

function TaskDetailModal({ task, taskIdx, dayIdx, weekStart, role, onClose }: {
  task: Task | CustomTask
  taskIdx: number
  dayIdx: number
  weekStart: string
  role: ShiftRole
  onClose: () => void
}) {
  const statusKey = `${weekStart}_${role}_${taskIdx}_${dayIdx}`
  const state = loadHimmapunState()
  const [status, setStatusLocal] = useState<TaskStatusVal>(state.taskStatus?.[statusKey] ?? 'pending')
  const [submissions] = useState<TaskSubmission[]>(state.taskSubmissions ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const videoRef = useRef<HTMLInputElement>(null)
  const [recipeLinks, setRecipeLinks] = useState<string[]>(() => loadTaskRecipeLinks()[String(taskIdx)] ?? [])
  const [cookbookRecipes] = useState<Recipe[]>(() => loadCookbookRecipes())
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null)

  function addRecipeLink(id: string) {
    if (recipeLinks.includes(id)) return
    const next = [...recipeLinks, id]
    setRecipeLinks(next)
    const current = loadTaskRecipeLinks()
    saveTaskRecipeLinks({ ...current, [String(taskIdx)]: next })
  }

  function removeRecipeLink(id: string) {
    const next = recipeLinks.filter(x => x !== id)
    setRecipeLinks(next)
    const current = loadTaskRecipeLinks()
    saveTaskRecipeLinks({ ...current, [String(taskIdx)]: next })
  }

  const existingSub = submissions.find(s => s.taskIdx === taskIdx && s.weekStart === weekStart && s.dayIdx === dayIdx && s.role === role)

  function saveStatus(val: TaskStatusVal) {
    setStatusLocal(val)
    const current = loadHimmapunState()
    saveHimmapunPatch({ taskStatus: { ...(current.taskStatus ?? {}), [statusKey]: val } })
  }

  async function uploadVideo(file: File) {
    setUploading(true)
    setUploadMsg('Uploading video…')
    try {
      const supabase = createClient()
      const path = `task-videos/${role}/${weekStart}_${taskIdx}_${dayIdx}_${Date.now()}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from(TASK_VIDEO_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
      if (error) { setUploadMsg('Upload failed: ' + error.message); setUploading(false); return }

      const sub: TaskSubmission = {
        id: `${Date.now()}`,
        taskIdx, taskName: task.name, weekStart, dayIdx, role,
        videoPath: path,
        submittedAt: new Date().toISOString(),
        reviewStatus: 'pending',
        reviewNote: '',
      }
      const current = loadHimmapunState()
      const existing = current.taskSubmissions ?? []
      const filtered = existing.filter(s => !(s.taskIdx === taskIdx && s.weekStart === weekStart && s.dayIdx === dayIdx && s.role === role))
      saveHimmapunPatch({ taskSubmissions: [...filtered, sub] })
      setUploadMsg('✓ Sent to GM for review')
    } catch {
      setUploadMsg('Upload failed — check connection')
    }
    setUploading(false)
  }

  const statusColors: Record<TaskStatusVal, { bg: string; color: string }> = {
    pending:  { bg: 'var(--surface2)', color: 'var(--muted)' },
    done:     { bg: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    skipped:  { bg: 'rgba(251,191,36,0.15)', color: '#fbbf24' },
    na:       { bg: 'rgba(156,163,175,0.15)', color: 'var(--muted)' },
  }

  const sc = statusColors[status]

  return (
    <>
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '0 0 32px' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              {task.section} · {task.time} · {DAY_FULL_NAMES[dayIdx]}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{task.name}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', padding: '0', lineHeight: 1 }}>✕</button>
        </div>

        {/* Status */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['done', 'skipped', 'na', 'pending'] as TaskStatusVal[]).map(s => (
              <button key={s} onClick={() => saveStatus(s)}
                style={{ ...ACTION_BTN, fontSize: '12px', padding: '6px 14px', background: status === s ? statusColors[s].bg : 'transparent', color: status === s ? statusColors[s].color : 'var(--muted)', border: `0.5px solid ${status === s ? statusColors[s].color : 'var(--border2)'}`, textTransform: 'capitalize' }}>
                {s === 'na' ? 'N/A' : s === 'pending' ? 'Reset' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            {status !== 'pending' && (
              <span style={{ fontSize: '12px', padding: '6px 12px', borderRadius: '6px', background: sc.bg, color: sc.color, fontWeight: 600 }}>
                {status === 'done' ? '✓ Completed' : status === 'skipped' ? '⟳ Skipped' : 'N/A'}
              </span>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>How to complete</div>
          <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(task.instructions ?? []).map((step, i) => (
              <li key={i} style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.55 }}>{step}</li>
            ))}
          </ol>
        </div>

        {/* Video submission */}
        <div style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Submit video for review</div>
          {existingSub && (
            <div style={{ background: 'rgba(34,197,94,0.1)', border: '0.5px solid rgba(74,222,128,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '10px', fontSize: '12px', color: '#4ade80' }}>
              ✓ Video submitted · {new Date(existingSub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {' · '}
              <span style={{ color: existingSub.reviewStatus === 'approved' ? '#4ade80' : existingSub.reviewStatus === 'rejected' ? '#f87171' : '#fbbf24', fontWeight: 600, textTransform: 'capitalize' }}>
                {existingSub.reviewStatus}
              </span>
              {existingSub.reviewNote && <div style={{ color: 'var(--muted)', marginTop: '4px' }}>{existingSub.reviewNote}</div>}
            </div>
          )}
          <button onClick={() => videoRef.current?.click()} disabled={uploading}
            style={{ ...ACTION_BTN, fontSize: '13px', padding: '8px 16px', background: 'rgba(200,232,74,0.1)', color: 'var(--accent)', borderColor: 'var(--accent)', marginRight: '10px' }}>
            {uploading ? '⏳ Uploading…' : existingSub ? '📹 Replace video' : '📹 Record / Upload video'}
          </button>
          {uploadMsg && (
            <span style={{ fontSize: '12px', color: uploadMsg.startsWith('✓') ? '#4ade80' : '#f87171' }}>{uploadMsg}</span>
          )}
          <input ref={videoRef} type="file" accept="video/*" capture="environment" style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadVideo(f); e.target.value = '' }} />
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>Video is sent to GM/CEO for review after upload.</div>
        </div>

        {/* Linked recipes */}
        <div style={{ padding: '16px 20px', borderTop: '0.5px solid var(--border)' }}>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Linked Recipes</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {recipeLinks.map(id => {
              const r = cookbookRecipes.find(x => x.id === id)
              if (!r) return null
              return (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '5px 10px', borderRadius: '12px', background: 'rgba(200,232,74,0.12)', color: 'var(--accent)', border: '0.5px solid rgba(200,232,74,0.3)', cursor: 'pointer' }}
                  onClick={() => setViewRecipe(r)}>
                  📖 {r.name}
                  <button onClick={e => { e.stopPropagation(); removeRecipeLink(id) }} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0', lineHeight: 1, fontSize: '13px' }}>×</button>
                </span>
              )
            })}
            {recipeLinks.length === 0 && <span style={{ fontSize: '12px', color: 'var(--muted)', fontStyle: 'italic' }}>No recipes linked.</span>}
          </div>
          <select onChange={e => { const v = e.target.value; if (v) addRecipeLink(v); e.target.value = '' }}
            style={{ ...INPUT_STYLE, fontSize: '12px' }}>
            <option value="">+ Attach recipe…</option>
            {cookbookRecipes.filter(r => !recipeLinks.includes(r.id)).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
    {viewRecipe && <RecipeViewModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} />}
    </>
  )
}

// ─── Add Task Modal ───────────────────────────────────────────────────────────

const SLOT_OPTIONS: SlotType[] = ['Morning', 'Mid day', 'Afternoon', 'Evening']

function AddTaskModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName]               = useState('')
  const [section, setSection]         = useState<'Accommodation & Farm' | 'Kitchen' | 'Office'>('Accommodation & Farm')
  const [slot, setSlot]               = useState<SlotType>('Morning')
  const [noDeadline, setNoDeadline]   = useState(false)
  const [instructions, setInstructions] = useState('')
  const [days, setDays]               = useState<Assignee[]>(['KTC', 'KTC', 'KTC', 'KTC', 'KTC', 'KTC', 'KTC'])
  const [saving, setSaving]           = useState(false)
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<string[]>([])
  const [cookbookRecipes] = useState<Recipe[]>(() => loadCookbookRecipes())

  function setDay(i: number, val: Assignee) {
    const next = [...days] as typeof days
    next[i] = val
    setDays(next)
  }

  function save() {
    if (!name.trim()) return
    setSaving(true)
    const noDeadlineDays: [Assignee, Assignee, Assignee, Assignee, Assignee, Assignee, Assignee] = ['-', '-', '-', '-', '-', '-', '-']
    const ct: CustomTask = {
      id: `custom_${Date.now()}`,
      name: name.trim(),
      section,
      time: SLOT_LABELS[slot],
      slot,
      noDeadline,
      instructions: instructions.split('\n').map(s => s.trim()).filter(Boolean),
      days: noDeadline ? noDeadlineDays : days as [Assignee, Assignee, Assignee, Assignee, Assignee, Assignee, Assignee],
    }
    const current = loadHimmapunState()
    const newTaskIdx = TASKS.length + (current.customTasks ?? []).length
    const patch: Partial<HimmapunState> = { customTasks: [...(current.customTasks ?? []), ct] }
    if (selectedRecipeIds.length > 0) {
      patch.taskRecipeLinks = { ...(current.taskRecipeLinks ?? {}), [String(newTaskIdx)]: selectedRecipeIds }
    }
    saveHimmapunPatch(patch)
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '20px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', width: '100%', maxWidth: '560px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>Add Task</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Task name *</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Pool cleaning" style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box', fontSize: '13px' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Section</label>
            <select value={section} onChange={e => setSection(e.target.value as typeof section)} style={{ ...INPUT_STYLE, width: '100%' }}>
              {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Time slot</label>
            <select value={slot} onChange={e => setSlot(e.target.value as SlotType)} style={{ ...INPUT_STYLE, width: '100%' }}>
              {SLOT_OPTIONS.map(s => <option key={s} value={s}>{SLOT_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        {/* No deadline toggle */}
        <div style={{ marginBottom: '14px', background: noDeadline ? 'rgba(200,232,74,0.08)' : 'var(--bg)', border: `0.5px solid ${noDeadline ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => setNoDeadline(v => !v)}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: noDeadline ? 'var(--accent)' : 'var(--text)' }}>No fixed deadline</div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Appears in &quot;No Deadline&quot; tab on staff portal — not tied to a specific day</div>
          </div>
          <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: noDeadline ? 'var(--accent)' : 'var(--border2)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', top: '2px', left: noDeadline ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
          </div>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Instructions (one step per line)</label>
          <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={4} placeholder={'Step 1\nStep 2\nStep 3'} style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }} />
        </div>

        {!noDeadline && (
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>Assign per day</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {DAY_LABELS.map((day, i) => (
                <div key={i}>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', textAlign: 'center', marginBottom: '3px' }}>{day}</div>
                  <select value={days[i]} onChange={e => setDay(i, e.target.value as Assignee)} style={{ ...INPUT_STYLE, padding: '4px 2px', fontSize: '11px', width: '100%' }}>
                    {ALL_ASSIGNEES.map(a => <option key={a} value={a}>{a === '-' ? '—' : a}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attach recipes */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '8px' }}>Attach recipes from Cook Book (optional)</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            {selectedRecipeIds.map(id => {
              const r = cookbookRecipes.find(x => x.id === id)
              if (!r) return null
              return (
                <span key={id} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: 'rgba(200,232,74,0.12)', color: 'var(--accent)', border: '0.5px solid rgba(200,232,74,0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  📖 {r.name}
                  <button onClick={() => setSelectedRecipeIds(ids => ids.filter(x => x !== id))} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '0', lineHeight: 1, fontSize: '13px' }}>×</button>
                </span>
              )
            })}
          </div>
          <select onChange={e => { const v = e.target.value; if (v && !selectedRecipeIds.includes(v)) setSelectedRecipeIds(ids => [...ids, v]); e.target.value = '' }}
            style={{ ...INPUT_STYLE, fontSize: '12px' }}>
            <option value="">+ Add recipe…</option>
            {cookbookRecipes.filter(r => !selectedRecipeIds.includes(r.id)).map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={ACTION_BTN}>Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()} style={{ ...ACTION_BTN, background: 'var(--accent)', color: '#0e0f0e', border: 'none', fontWeight: 600 }}>
            {saving ? 'Saving…' : 'Add Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Role Overview Panel ──────────────────────────────────────────────────────

function RoleOverviewPanel({ role, weekStart, weekDates, overrides, onOpenTask }: {
  role: ShiftRole
  weekStart: string
  weekDates: string[]
  overrides: Record<string, Assignee>
  onOpenTask: (task: Task | CustomTask, taskIdx: number, dayIdx: number) => void
}) {
  const todayStr = localDateStr(new Date())
  const defaultDay = weekDates.includes(todayStr) ? todayStr : weekDates[0]
  const [selectedDate, setSelectedDate] = useState(defaultDay)
  const dayIdx = weekDates.indexOf(selectedDate)

  const state = loadHimmapunState()
  const allTasks: (Task | CustomTask)[] = [
    ...TASKS,
    ...(state.customTasks ?? []),
  ]
  const allTasksIndexed = allTasks.map((t, i) => ({ task: t, idx: i }))
  const visibleTasks = allTasksIndexed.filter(({ task, idx }) => {
    const assignee = getAssigneeForCell(overrides, weekStart, idx, dayIdx, allTasks[idx]?.days[dayIdx])
    return isVisibleToRole(assignee, role)
  })

  const statusMap = state.taskStatus ?? {}
  const getStatus = (taskIdx: number): TaskStatusVal => statusMap[`${weekStart}_${role}_${taskIdx}_${dayIdx}`] ?? 'pending'
  const done = visibleTasks.filter(({ idx }) => getStatus(idx) === 'done').length
  const total = visibleTasks.length
  const remaining = visibleTasks.filter(({ idx }) => getStatus(idx) === 'pending').length
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  const rc = roleColor(role)

  return (
    <div style={{ background: 'var(--surface)', border: `0.5px solid ${rc.border}`, borderRadius: '10px', padding: '16px', marginBottom: '12px' }}>
      {/* Role header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: rc.bg, color: rc.color, border: `0.5px solid ${rc.border}` }}>{role}</span>
        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{SHIFT_ROLE_NAMES[role]}</span>
      </div>

      {/* Day strip */}
      <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', marginBottom: '12px', scrollbarWidth: 'none' }}>
        {weekDates.map((date, i) => {
          const active = date === selectedDate
          const isToday = date === todayStr
          return (
            <button key={date} onClick={() => setSelectedDate(date)} style={{
              flex: '0 0 auto', minWidth: '52px', padding: '6px 4px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'center',
              background: active ? rc.color : isToday ? rc.bg : 'var(--bg)',
              color: active ? '#0e0f0e' : isToday ? rc.color : 'var(--muted)',
              outline: isToday && !active ? `1.5px solid ${rc.border}` : 'none',
              fontFamily: 'var(--font-dm-sans)',
            }}>
              <div style={{ fontSize: '10px', fontWeight: 700 }}>{DAY_LABELS[i]}</div>
              <div style={{ fontSize: '12px' }}>{fmtShortDate(date)}</div>
            </button>
          )
        })}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '8px' }}>
        {[['Done', done, '#4ade80'], ['Remaining', remaining, '#fbbf24'], ['Total', total, 'var(--text)']].map(([label, val, color]) => (
          <div key={label as string} style={{ background: 'var(--bg)', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: color as string }}>{val as number}</div>
            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#4ade80', borderRadius: '2px', transition: 'width 0.3s' }} />
      </div>

      {/* Task list */}
      {SECTIONS.map(section => {
        const sectionTasks = visibleTasks.filter(({ task }) => task.section === section)
        if (sectionTasks.length === 0) return null
        return (
          <div key={section}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px', marginTop: '10px' }}>{section}</div>
            {sectionTasks.map(({ task, idx }) => {
              const s = getStatus(idx)
              const isDone = s === 'done'
              const isDimmed = s === 'skipped' || s === 'na'
              const sub = (state.taskSubmissions ?? []).find(sub => sub.taskIdx === idx && sub.weekStart === weekStart && sub.dayIdx === dayIdx && sub.role === role)
              return (
                <div key={idx} onClick={() => onOpenTask(task, idx, dayIdx)}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg)', marginBottom: '4px', cursor: 'pointer', opacity: isDimmed ? 0.55 : 1, border: isDone ? '0.5px solid rgba(74,222,128,0.3)' : '0.5px solid var(--border)' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#4ade80' : 'transparent', border: isDone ? 'none' : '1.5px solid var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {isDone && <span style={{ color: '#0e0f0e', fontSize: '11px', fontWeight: 800 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: isDone ? 'var(--muted)' : 'var(--text)', textDecoration: isDone ? 'line-through' : 'none' }}>
                    {task.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    {sub && <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '10px', background: sub.reviewStatus === 'approved' ? 'rgba(74,222,128,0.15)' : sub.reviewStatus === 'rejected' ? 'rgba(248,113,113,0.15)' : 'rgba(251,191,36,0.15)', color: sub.reviewStatus === 'approved' ? '#4ade80' : sub.reviewStatus === 'rejected' ? '#f87171' : '#fbbf24', fontWeight: 600 }}>📹 {sub.reviewStatus}</span>}
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{'slot' in task ? SLOT_LABELS[(task as CustomTask).slot] : SLOT_LABELS[timeToSlot(task.time)]}</span>
                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>›</span>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {visibleTasks.length === 0 && (
        <div style={{ fontSize: '12px', color: 'var(--muted)', textAlign: 'center', padding: '16px', fontStyle: 'italic' }}>No tasks assigned for this day.</div>
      )}
    </div>
  )
}

// ─── Video Review Panel ───────────────────────────────────────────────────────

function VideoReviewPanel() {
  const state = loadHimmapunState()
  const subs = state.taskSubmissions ?? []
  const pending = subs.filter(s => s.reviewStatus === 'pending')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [note, setNote] = useState('')

  if (pending.length === 0) return null

  async function viewVideo(sub: TaskSubmission) {
    const { data } = await createClient().storage.from(TASK_VIDEO_BUCKET).createSignedUrl(sub.videoPath, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function decide(subId: string, decision: 'approved' | 'rejected') {
    const current = loadHimmapunState()
    const updated = (current.taskSubmissions ?? []).map(s => s.id === subId ? { ...s, reviewStatus: decision, reviewNote: note } : s)
    saveHimmapunPatch({ taskSubmissions: updated })
    setReviewing(null)
    setNote('')
  }

  return (
    <div style={{ ...CARD, border: '0.5px solid rgba(251,191,36,0.4)', marginBottom: '16px' }}>
      <div style={{ ...SECTION_LABEL, color: '#fbbf24', marginBottom: '10px' }}>📹 Pending Video Reviews ({pending.length})</div>
      {pending.map(sub => (
        <div key={sub.id} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>{sub.taskName}</div>
              <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{sub.role} · {DAY_FULL_NAMES[sub.dayIdx]} · {new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => viewVideo(sub)} style={{ ...ACTION_BTN, fontSize: '12px' }}>▶ Watch</button>
              <button onClick={() => setReviewing(reviewing === sub.id ? null : sub.id)} style={{ ...ACTION_BTN, fontSize: '12px', color: 'var(--accent)', borderColor: 'var(--accent)' }}>Review</button>
            </div>
          </div>
          {reviewing === sub.id && (
            <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional feedback note…" style={{ ...INPUT_STYLE, fontSize: '12px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => decide(sub.id, 'approved')} style={{ ...ACTION_BTN, color: '#4ade80', borderColor: '#4ade80', fontSize: '12px' }}>✓ Approve</button>
                <button onClick={() => decide(sub.id, 'rejected')} style={{ ...ACTION_BTN, color: '#f87171', borderColor: '#f87171', fontSize: '12px' }}>✕ Reject</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── ShiftsTab ────────────────────────────────────────────────────────────────

function ShiftsTab() {
  const todayStr = localDateStr(new Date())
  const [weekStart, setWeekStart] = useState(getWeekMonday)
  const [overrides, setOverrides] = useState<Record<string, Assignee>>(loadTaskOverrides)
  const [activeCell, setActiveCell] = useState<{ taskIdx: number; dayIdx: number } | null>(null)
  const [activeRole, setActiveRole] = useState<ShiftRole | null>(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [hideRoutine, setHideRoutine] = useState(false)
  const [detailTask, setDetailTask] = useState<{ task: Task | CustomTask; taskIdx: number; dayIdx: number; role: ShiftRole } | null>(null)
  const [customTasks, setCustomTasks] = useState<CustomTask[]>(loadHimmapunState().customTasks ?? [])

  const weekDates = Array.from({ length: 7 }, (_, i) => addDaysLocal(weekStart, i))
  const todayDayIdx = weekDates.indexOf(todayStr)

  const allTasks = [...TASKS, ...customTasks]

  function refreshCustomTasks() {
    setCustomTasks(loadHimmapunState().customTasks ?? [])
  }

  function setAssignee(taskIdx: number, dayIdx: number, value: Assignee) {
    const key = overrideKey(weekStart, taskIdx, dayIdx)
    const next = { ...overrides }
    if (taskIdx < TASKS.length && value === TASKS[taskIdx].days[dayIdx]) {
      delete next[key]
    } else {
      next[key] = value
    }
    setOverrides(next)
    saveTaskOverrides(next)
    setActiveCell(null)
  }

  function resetAll() {
    if (!confirm('Reset all task assignments to defaults for this week?')) return
    setOverrides({})
    saveTaskOverrides({})
  }

  const TASK_COL = 180

  return (
    <div style={{ position: 'relative' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>Weekly Task Planner</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {fmtShortDate(weekStart)} – {fmtShortDate(weekDates[6])} · Click any cell to reassign
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '12px', color: 'var(--muted)' }}>Week of</label>
          <input type="date" value={weekStart}
            onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (d.getDay() === 1) setWeekStart(e.target.value) }}
            style={{ ...INPUT_STYLE, fontSize: '12px' }} />
          <button onClick={() => setHideRoutine(v => !v)} style={{ ...ACTION_BTN, fontSize: '12px', background: hideRoutine ? 'rgba(200,232,74,0.1)' : 'transparent', color: hideRoutine ? 'var(--accent)' : 'var(--muted)', borderColor: hideRoutine ? 'var(--accent)' : 'var(--border2)' }}>
            {hideRoutine ? '✓ Routine hidden' : 'Hide routine'}
          </button>
          <button onClick={resetAll} style={{ ...ACTION_BTN, color: '#f87171', borderColor: '#f87171', fontSize: '12px' }}>Reset all</button>
          <button onClick={() => setShowAddTask(true)} style={{ ...ACTION_BTN, background: 'var(--accent)', color: '#0e0f0e', border: 'none', fontWeight: 600, fontSize: '12px' }}>+ Add Task</button>
        </div>
      </div>

      {/* Video review panel */}
      <VideoReviewPanel />

      {/* Overview Task panel */}
      {(() => {
        const overviewDayIdx = weekDates.indexOf(todayStr) >= 0 ? weekDates.indexOf(todayStr) : 0
        const statusMap = loadHimmapunState().taskStatus ?? {}
        return (
          <div style={{ ...CARD, marginBottom: '14px' }}>
            <div style={{ ...SECTION_LABEL, marginBottom: '10px' }}>Overview · {todayStr === weekDates[overviewDayIdx] ? 'Today' : DAY_LABELS[overviewDayIdx]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {SHIFT_ROLES.map(r => {
                const rc = roleColor(r)
                const roleTasks = allTasks
                  .map((t, idx) => ({ t, idx }))
                  .filter(({ idx }) => isVisibleToRole(getAssigneeForCell(overrides, weekStart, idx, overviewDayIdx, allTasks[idx]?.days[overviewDayIdx]), r))
                const doneCnt = roleTasks.filter(({ idx }) => statusMap[`${weekStart}_${r}_${idx}_${overviewDayIdx}`] === 'done').length
                const total   = roleTasks.length
                const pct     = total === 0 ? 0 : Math.round((doneCnt / total) * 100)
                return (
                  <div key={r} style={{ background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px', border: `0.5px solid ${rc.border}`, cursor: 'pointer' }}
                    onClick={() => setActiveRole(activeRole === r ? null : r)}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: rc.color, marginBottom: '4px' }}>{r}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{doneCnt}<span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 400 }}>/{total}</span></div>
                    <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', marginTop: '6px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: rc.color, borderRadius: '2px', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Role overview buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {SHIFT_ROLES.map(r => {
          const rc = roleColor(r)
          const isActive = activeRole === r
          return (
            <button key={r} onClick={() => setActiveRole(isActive ? null : r)}
              style={{ ...ACTION_BTN, fontSize: '12px', padding: '7px 16px', background: isActive ? rc.bg : 'transparent', color: isActive ? rc.color : 'var(--muted)', border: `0.5px solid ${isActive ? rc.border : 'var(--border2)'}`, fontWeight: isActive ? 700 : 400 }}>
              {r} — {SHIFT_ROLE_NAMES[r]}
            </button>
          )
        })}
        <span style={{ fontSize: '11px', color: 'var(--muted)', alignSelf: 'center', marginLeft: '4px' }}>Click a role to see their week</span>
      </div>

      {/* Role overview panel */}
      {activeRole && (
        <RoleOverviewPanel
          role={activeRole}
          weekStart={weekStart}
          weekDates={weekDates}
          overrides={overrides}
          onOpenTask={(task, taskIdx, dayIdx) => setDetailTask({ task, taskIdx, dayIdx, role: activeRole })}
        />
      )}

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
        {ALL_ASSIGNEES.filter(a => a !== '-').map(a => {
          const st = assigneeBadgeStyle(a)
          return (
            <span key={a} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: st.bg, color: st.color, border: `0.5px solid ${st.border}`, fontWeight: 600 }}>
              {a}
            </span>
          )
        })}
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'transparent', color: 'var(--muted)', border: '0.5px dashed var(--border2)', fontWeight: 500 }}>
          dashed = overridden
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', borderRadius: '8px', border: '0.5px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: `${TASK_COL + 90 * 7}px`, width: '100%' }}>
          <thead>
            <tr style={{ background: 'var(--surface2)' }}>
              <th style={{ ...TH, width: TASK_COL, minWidth: TASK_COL, position: 'sticky', left: 0, background: 'var(--surface2)', zIndex: 10, borderRight: '0.5px solid var(--border)' }}>
                Task
              </th>
              {weekDates.map((date, i) => (
                <th key={date} style={{ ...TH, textAlign: 'center', width: 90, minWidth: 90, color: i === todayDayIdx ? 'var(--accent)' : 'var(--muted)', background: i === todayDayIdx ? 'rgba(200,232,74,0.08)' : 'var(--surface2)' }}>
                  <div>{DAY_LABELS[i]}</div>
                  <div style={{ fontWeight: 400, fontSize: '10px', marginTop: '1px', opacity: 0.7 }}>{fmtShortDate(date)}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {SECTIONS.map(section => {
              const visibleTasksForSection = allTasks
                .map((t, i) => ({ task: t, idx: i }))
                .filter(({ task, idx }) => task.section === section && !(hideRoutine && idx < TASKS.length))
              const rows = visibleTasksForSection
              return rows.map(({ task, idx }, rowI) => (
                <>
                  {rowI === 0 && (
                    <tr key={`sec-${section}`} style={{ background: 'rgba(200,232,74,0.05)' }}>
                      <td colSpan={8} style={{ padding: '6px 12px', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em', textTransform: 'uppercase', position: 'sticky', left: 0 }}>
                        {section}
                      </td>
                    </tr>
                  )}
                  <tr key={idx} style={{ borderBottom: '0.5px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>

                    <td style={{ ...TD, position: 'sticky', left: 0, background: 'var(--bg)', zIndex: 5, borderRight: '0.5px solid var(--border)', maxWidth: TASK_COL, fontSize: '12px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.name}>{task.name}</div>
                      <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                        {'slot' in task ? SLOT_LABELS[(task as CustomTask).slot] : SLOT_LABELS[timeToSlot(task.time)]}
                      </div>
                    </td>

                    {weekDates.map((_, dayIdx) => {
                      const assignee = getAssigneeForCell(overrides, weekStart, idx, dayIdx, task.days[dayIdx])
                      const isNone = assignee === '-'
                      const st = assigneeBadgeStyle(assignee)
                      const isActive = activeCell?.taskIdx === idx && activeCell?.dayIdx === dayIdx
                      const isOverridden = !!overrides[overrideKey(weekStart, idx, dayIdx)]
                      const isToday = dayIdx === todayDayIdx

                      return (
                        <td key={dayIdx} style={{ ...TD, textAlign: 'center', padding: '5px 4px', background: isToday ? 'rgba(200,232,74,0.04)' : undefined, position: 'relative' }}
                          onClick={() => setActiveCell(isActive ? null : { taskIdx: idx, dayIdx })}>
                          {isActive ? (
                            <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: 'var(--surface)', border: '0.5px solid var(--border)', borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', padding: '6px', zIndex: 100, minWidth: '130px' }}>
                              {ALL_ASSIGNEES.map(opt => {
                                const os = assigneeBadgeStyle(opt)
                                const isCurrent = assignee === opt
                                return (
                                  <button key={opt} onClick={e => { e.stopPropagation(); setAssignee(idx, dayIdx, opt) }}
                                    style={{ display: 'block', width: '100%', padding: '7px 10px', textAlign: 'left', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', fontWeight: isCurrent ? 700 : 400, background: isCurrent ? os.bg : 'transparent', color: isCurrent ? os.color : 'var(--text)', marginBottom: '1px', fontFamily: 'var(--font-dm-sans)' }}>
                                    {opt === '-' ? '— nobody —' : opt}
                                    {idx < TASKS.length && opt === TASKS[idx].days[dayIdx] && <span style={{ fontSize: '10px', color: 'var(--muted)', marginLeft: '4px' }}>(default)</span>}
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <span style={{ display: 'inline-block', padding: '3px 7px', borderRadius: '5px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', background: isNone ? 'transparent' : st.bg, color: isNone ? 'var(--muted)' : st.color, border: isOverridden ? `1px dashed ${st.border}` : `0.5px solid ${isNone ? 'transparent' : st.border}`, minWidth: '52px' }}>
                              {isNone ? '—' : assignee}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                </>
              ))
            })}
          </tbody>
        </table>
      </div>

      {activeCell && <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setActiveCell(null)} />}

      {/* Add Task Modal */}
      {showAddTask && <AddTaskModal onClose={() => setShowAddTask(false)} onSaved={() => { setShowAddTask(false); refreshCustomTasks() }} />}

      {/* Task Detail Modal */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask.task}
          taskIdx={detailTask.taskIdx}
          dayIdx={detailTask.dayIdx}
          weekStart={weekStart}
          role={detailTask.role}
          onClose={() => setDetailTask(null)}
        />
      )}
    </div>
  )
}


// ─── Recipe View Modal ────────────────────────────────────────────────────────

function RecipeViewModal({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const hasBatchMode = !!recipe.portionsPerBatch
  const [mode, setMode]             = useState<'custom' | 'guests'>(hasBatchMode ? 'guests' : 'custom')
  const [servings, setServings]     = useState(recipe.baseServings)
  const [guestCount, setGuestCount] = useState<number>(0)
  const [loadingGuests, setLoadingGuests] = useState(hasBatchMode)

  // Fetch today's guest count from bookings
  useEffect(() => {
    if (!hasBatchMode) return
    const today = localDateStr(new Date())
    createClient()
      .from('bookings')
      .select('guests, checkin, checkout, status')
      .then(({ data }) => {
        if (!data) return
        const total = data
          .filter(b => b.checkin <= today && b.checkout > today && ['Occupied', 'Check-in', 'Checkout'].includes(b.status))
          .reduce((s: number, b: { guests: number }) => s + (b.guests || 1), 0)
        setGuestCount(total)
        setLoadingGuests(false)
      })
  }, [hasBatchMode])

  const portionsPerBatch = recipe.portionsPerBatch ?? 1
  const batches = mode === 'guests' ? Math.max(1, Math.ceil(guestCount / portionsPerBatch)) : null
  const scale   = mode === 'guests'
    ? (batches ?? 1)
    : servings / recipe.baseServings

  function fmtAmt(amount: number): string {
    const scaled = amount * scale
    return scaled % 1 === 0 ? String(scaled) : scaled.toFixed(1)
  }

  const modeTabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1, padding: '7px 0', fontSize: '12px', fontWeight: active ? 600 : 400,
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#0e0f0e' : 'var(--muted)',
    border: 'none', cursor: 'pointer', borderRadius: '6px', transition: 'all 0.15s',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '0 0 40px' }}>

        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
              {recipe.category} · {recipe.tags?.join(' · ')}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)' }}>{recipe.name}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{recipe.description}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px', padding: '0', lineHeight: 1, flexShrink: 0, marginLeft: '12px' }}>✕</button>
        </div>

        {/* Time info */}
        <div style={{ display: 'flex', gap: '8px', padding: '14px 20px', borderBottom: '0.5px solid var(--border)', flexWrap: 'wrap' }}>
          {recipe.prepTime > 0 && <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: 'var(--bg)', color: 'var(--muted)', border: '0.5px solid var(--border)' }}>⏱ Prep {recipe.prepTime} min</span>}
          {recipe.cookTime > 0 && <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: 'var(--bg)', color: 'var(--muted)', border: '0.5px solid var(--border)' }}>🔥 Cook {recipe.cookTime} min</span>}
          <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: 'var(--bg)', color: 'var(--muted)', border: '0.5px solid var(--border)' }}>📦 1 batch = {recipe.baseServings} {recipe.servingUnit}</span>
          {hasBatchMode && <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '12px', background: 'var(--bg)', color: 'var(--muted)', border: '0.5px solid var(--border)' }}>👥 serves {portionsPerBatch} guests/batch</span>}
        </div>

        {/* Mode toggle + calculator */}
        <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)' }}>

          {/* Toggle */}
          {hasBatchMode && (
            <div style={{ display: 'flex', gap: '4px', background: 'var(--bg)', borderRadius: '8px', padding: '3px', marginBottom: '14px', border: '0.5px solid var(--border)' }}>
              <button style={modeTabStyle(mode === 'guests')} onClick={() => setMode('guests')}>For today&apos;s guests</button>
              <button style={modeTabStyle(mode === 'custom')} onClick={() => setMode('custom')}>Custom</button>
            </div>
          )}

          {/* Guest mode */}
          {mode === 'guests' && hasBatchMode && (
            <div>
              {loadingGuests ? (
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Loading guest count…</div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Guests today</span>
                      <button onClick={() => setGuestCount(g => Math.max(0, g - 1))} style={{ ...ACTION_BTN, width: '28px', padding: '3px', textAlign: 'center' }}>−</button>
                      <input type="number" min={0} value={guestCount} onChange={e => setGuestCount(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{ ...INPUT_STYLE, width: '56px', textAlign: 'center', fontWeight: 600 }} />
                      <button onClick={() => setGuestCount(g => g + 1)} style={{ ...ACTION_BTN, width: '28px', padding: '3px', textAlign: 'center' }}>+</button>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>÷ {portionsPerBatch} guests/batch</span>
                  </div>

                  {/* Batch recommendation */}
                  <div style={{ background: 'rgba(200,232,74,0.08)', border: '0.5px solid rgba(200,232,74,0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '36px', fontWeight: 800, color: 'var(--accent)', lineHeight: 1 }}>{batches}</div>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                        {batches === 1 ? 'batch' : 'batches'} needed
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                        {guestCount} guests · {batches! * portionsPerBatch} {recipe.servingUnit} total
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Custom mode */}
          {mode === 'custom' && (
            <div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Batches</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={() => setServings(s => Math.max(1, s - recipe.baseServings))} style={{ ...ACTION_BTN, width: '32px', padding: '4px', textAlign: 'center', fontSize: '16px' }}>−</button>
                <input type="number" min={1} value={servings / recipe.baseServings} onChange={e => setServings(Math.max(1, (parseInt(e.target.value) || 1) * recipe.baseServings))}
                  style={{ ...INPUT_STYLE, width: '64px', textAlign: 'center', fontSize: '15px', fontWeight: 600 }} />
                <button onClick={() => setServings(s => s + recipe.baseServings)} style={{ ...ACTION_BTN, width: '32px', padding: '4px', textAlign: 'center', fontSize: '16px' }}>+</button>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                  {hasBatchMode ? `× ${recipe.baseServings} ${recipe.servingUnit} = ${servings} ${recipe.servingUnit} total` : recipe.servingUnit}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Ingredients */}
        {recipe.ingredients.length > 0 && (
          <div style={{ padding: '14px 20px', borderBottom: '0.5px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Ingredients</div>
              {scale !== 1 && (
                <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(200,232,74,0.12)', color: 'var(--accent)', border: '0.5px solid rgba(200,232,74,0.25)', fontWeight: 600 }}>
                  ×{scale % 1 === 0 ? scale : scale.toFixed(2)} scaled
                </span>
              )}
            </div>
            {recipe.ingredients.map((ing, i) => (
              ing.amount === 0 ? (
                <div key={i} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 0 4px', borderTop: i > 0 ? '0.5px solid var(--border)' : 'none' }}>{ing.name}</div>
              ) : (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 10px', borderRadius: '6px', background: i % 2 === 0 ? 'var(--bg)' : 'transparent', marginBottom: '2px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text)' }}>{ing.name}</span>
                  <span style={{ fontSize: '13px', color: 'var(--accent)', fontWeight: 600, whiteSpace: 'nowrap', marginLeft: '12px' }}>{fmtAmt(ing.amount)} {ing.unit}</span>
                </div>
              )
            ))}
          </div>
        )}

        {/* Steps */}
        {recipe.steps.length > 0 && (
          <div style={{ padding: '14px 20px' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>Steps</div>
            <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recipe.steps.map((step, i) => (
                <li key={i} style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.55 }}>{step}</li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Cook Book Tab ────────────────────────────────────────────────────────────

function CookBookTab() {
  const [recipes, setRecipes] = useState<Recipe[]>(() => loadCookbookRecipes())
  const [search, setSearch] = useState('')
  const [viewRecipe, setViewRecipe] = useState<Recipe | null>(null)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)

  function refresh() {
    setRecipes(loadCookbookRecipes())
  }

  function deleteRecipe(id: string) {
    if (!confirm('Delete this recipe?')) return
    const updated = recipes.filter(r => r.id !== id)
    saveCookbookRecipes(updated)
    setRecipes(updated)
  }

  const filtered = recipes.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  )

  const categories = ['Kitchen', 'Accommodation & Farm', 'Office'] as const

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>Cook Book</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{recipes.length} recipes · attach to task cards in Staff shifts</div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes…"
            style={{ ...INPUT_STYLE, fontSize: '12px', minWidth: '180px' }} />
          <button onClick={() => { setEditRecipe(null); setShowAddForm(true) }}
            style={{ ...ACTION_BTN, background: 'var(--accent)', color: '#0e0f0e', border: 'none', fontWeight: 600, fontSize: '12px' }}>
            + Add Recipe
          </button>
        </div>
      </div>

      {/* Recipe grid by category */}
      {categories.map(cat => {
        const catRecipes = filtered.filter(r => r.category === cat)
        if (catRecipes.length === 0) return null
        return (
          <div key={cat} style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{cat}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
              {catRecipes.map(recipe => (
                <div key={recipe.id} style={{ ...CARD, marginBottom: 0, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onClick={() => setViewRecipe(recipe)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', flex: 1, paddingRight: '8px' }}>{recipe.name}</div>
                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                      <button onClick={e => { e.stopPropagation(); setEditRecipe(recipe); setShowAddForm(true) }}
                        style={{ ...ACTION_BTN, fontSize: '11px', padding: '3px 8px', color: 'var(--muted)' }}>Edit</button>
                      <button onClick={e => { e.stopPropagation(); deleteRecipe(recipe.id) }}
                        style={{ ...ACTION_BTN, fontSize: '11px', padding: '3px 8px', color: '#f87171', borderColor: 'rgba(248,113,113,0.3)' }}>✕</button>
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px', lineHeight: 1.4 }}>{recipe.description}</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {(recipe.tags ?? []).map(t => (
                      <span key={t} style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'rgba(200,232,74,0.1)', color: 'var(--accent)', border: '0.5px solid rgba(200,232,74,0.25)' }}>{t}</span>
                    ))}
                    {recipe.prepTime > 0 && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'var(--surface2)', color: 'var(--muted)' }}>⏱ {recipe.prepTime}m prep</span>}
                    {recipe.cookTime > 0 && <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '10px', background: 'var(--surface2)', color: 'var(--muted)' }}>🔥 {recipe.cookTime}m cook</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)', fontSize: '13px', fontStyle: 'italic' }}>
          {search ? 'No recipes match your search.' : 'No recipes yet. Add your first recipe!'}
        </div>
      )}

      {viewRecipe && <RecipeViewModal recipe={viewRecipe} onClose={() => setViewRecipe(null)} />}
      {showAddForm && <RecipeEditModal recipe={editRecipe} onClose={() => { setShowAddForm(false); setEditRecipe(null) }} onSaved={() => { refresh(); setShowAddForm(false); setEditRecipe(null) }} />}
    </div>
  )
}

// ─── Recipe Edit Modal ────────────────────────────────────────────────────────

function RecipeEditModal({ recipe, onClose, onSaved }: { recipe: Recipe | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!recipe
  const [name, setName]               = useState(recipe?.name ?? '')
  const [description, setDescription] = useState(recipe?.description ?? '')
  const [category, setCategory]       = useState<Recipe['category']>(recipe?.category ?? 'Kitchen')
  const [baseServings, setBaseServings]     = useState(recipe?.baseServings ?? 4)
  const [servingUnit, setServingUnit]       = useState(recipe?.servingUnit ?? 'portions')
  const [portionsPerBatch, setPortionsPerBatch] = useState<number | ''>(recipe?.portionsPerBatch ?? '')
  const [prepTime, setPrepTime]             = useState(recipe?.prepTime ?? 0)
  const [cookTime, setCookTime]             = useState(recipe?.cookTime ?? 0)
  const [tagsRaw, setTagsRaw]         = useState((recipe?.tags ?? []).join(', '))
  const [ingredientsRaw, setIngredientsRaw] = useState(
    (recipe?.ingredients ?? []).map(i => i.amount === 0 ? `--- ${i.name}` : `${i.amount} ${i.unit} ${i.name}`).join('\n')
  )
  const [stepsRaw, setStepsRaw] = useState((recipe?.steps ?? []).join('\n'))
  const [saving, setSaving] = useState(false)

  function save() {
    if (!name.trim()) return
    setSaving(true)

    const ingredients = ingredientsRaw.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      if (l.startsWith('---')) return { name: l.replace(/^---\s*/, ''), amount: 0, unit: '' }
      const m = l.match(/^(\d+\.?\d*)\s+(\S+)\s+(.+)$/)
      if (m) return { amount: parseFloat(m[1]), unit: m[2], name: m[3] }
      return { name: l, amount: 0, unit: '' }
    })

    const updated: Recipe = {
      id: recipe?.id ?? `recipe_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      category,
      baseServings,
      servingUnit: servingUnit.trim() || 'portions',
      ...(portionsPerBatch !== '' && { portionsPerBatch: Number(portionsPerBatch) }),
      prepTime,
      cookTime,
      tags: tagsRaw.split(',').map(t => t.trim()).filter(Boolean),
      ingredients,
      steps: stepsRaw.split('\n').map(s => s.trim()).filter(Boolean),
    }

    const current = loadCookbookRecipes()
    const next = isEdit ? current.map(r => r.id === updated.id ? updated : r) : [...current, updated]
    saveCookbookRecipes(next)
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '20px' }}>
      <div style={{ background: 'var(--surface)', borderRadius: '12px', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>{isEdit ? 'Edit Recipe' : 'Add Recipe'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '20px' }}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Recipe name *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. House Sourdough" style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Description</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description for the card" style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value as Recipe['category'])} style={{ ...INPUT_STYLE, width: '100%' }}>
              <option value="Kitchen">Kitchen</option>
              <option value="Accommodation & Farm">Accommodation &amp; Farm</option>
              <option value="Office">Office</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Tags (comma-separated)</label>
            <input value={tagsRaw} onChange={e => setTagsRaw(e.target.value)} placeholder="Bakery, Daily" style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Base servings</label>
            <input type="number" min={1} value={baseServings} onChange={e => setBaseServings(parseInt(e.target.value) || 1)} style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Serving unit</label>
            <input value={servingUnit} onChange={e => setServingUnit(e.target.value)} placeholder="portions / loaves / cups…" style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
              Guests served per batch <span style={{ fontWeight: 400 }}>(optional — enables auto-scaling from today&apos;s guest count)</span>
            </label>
            <input type="number" min={1} value={portionsPerBatch}
              onChange={e => setPortionsPerBatch(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value) || 1))}
              placeholder="e.g. 8 — leave blank to skip batch mode"
              style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Prep time (min)</label>
            <input type="number" min={0} value={prepTime} onChange={e => setPrepTime(parseInt(e.target.value) || 0)} style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Cook time (min)</label>
            <input type="number" min={0} value={cookTime} onChange={e => setCookTime(parseInt(e.target.value) || 0)} style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>
            Ingredients (one per line: <code style={{ fontSize: '10px' }}>amount unit name</code> · use <code style={{ fontSize: '10px' }}>--- Section</code> for separators)
          </label>
          <textarea value={ingredientsRaw} onChange={e => setIngredientsRaw(e.target.value)} rows={7}
            placeholder={'500 g Bread flour\n150 g Sourdough starter\n--- Filling\n200 ml Whole milk'}
            style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'var(--font-dm-mono)', fontSize: '12px' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '4px' }}>Steps (one per line)</label>
          <textarea value={stepsRaw} onChange={e => setStepsRaw(e.target.value)} rows={6}
            placeholder={'Mix flour and water\nAdd starter and salt\nBake at 250°C'}
            style={{ ...INPUT_STYLE, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }} />
        </div>

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={ACTION_BTN}>Cancel</button>
          <button onClick={save} disabled={saving || !name.trim()} style={{ ...ACTION_BTN, background: 'var(--accent)', color: '#0e0f0e', border: 'none', fontWeight: 600 }}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Recipe'}
          </button>
        </div>
      </div>
    </div>
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
        {activeTab === 'cookbook'  && <CookBookTab />}
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
