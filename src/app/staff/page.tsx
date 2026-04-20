'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TASKS } from './tasks'
import type { Assignee } from './tasks'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role = 'KTC' | 'ACF' | 'GM' | 'CEO'
type TaskStatus = 'pending' | 'done' | 'skipped' | 'na'
type AppTab = 'tasks' | 'schedule' | 'bookings' | 'settings'

interface AppState {
  weekStart: string
  pins: Record<Role, string>
  dayOff: Record<Role, number[]>
  taskStatus: Record<string, TaskStatus>
  taskOverrides: Record<string, Assignee> // key: `${weekStart}_${taskIdx}_${dayIdx}`
}

interface Booking {
  id: number
  guest: string
  guest2: string
  room: string
  checkin: string
  checkout: string
  nights: number
  status: string
  passport_url: string | null
  passport_uploaded_at: string | null
  guest2_passport_url: string | null
  guest2_passport_uploaded_at: string | null
  booking_ref: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['KTC', 'ACF', 'GM', 'CEO']
const ROLE_NAMES: Record<Role, string> = { KTC: 'Kitchen Staff', ACF: 'Wan', GM: 'General Manager', CEO: 'Co-Owner' }
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const PASSPORT_BUCKET = 'booking-docs'

const ALL_ASSIGNEES: Assignee[] = ['KTC', 'ACF', 'GM', 'CEO', 'Anyone Free', 'All Staff', '-']

const ROLE_COLORS: Record<Role, { bg: string; tag: string; dark: string }> = {
  KTC: { bg: '#D6EAF8', tag: '#B5D4F4', dark: '#0C447C' },
  ACF: { bg: '#D8F3DC', tag: '#C0DD97', dark: '#1B4332' },
  GM:  { bg: '#D1F2EB', tag: '#9FE1CB', dark: '#085041' },
  CEO: { bg: '#EEEDFE', tag: '#AFA9EC', dark: '#3C3489' },
}

function assigneeStyle(a: Assignee): { bg: string; text: string } {
  if (a === 'KTC')         return { bg: '#D6EAF8', text: '#0C447C' }
  if (a === 'ACF')         return { bg: '#D8F3DC', text: '#1B4332' }
  if (a === 'GM')          return { bg: '#D1F2EB', text: '#085041' }
  if (a === 'CEO')         return { bg: '#EEEDFE', text: '#3C3489' }
  if (a === 'Anyone Free') return { bg: '#FEF9C3', text: '#92400E' }
  if (a === 'All Staff')   return { bg: '#FFE4C4', text: '#7C3D0C' }
  return { bg: '#F3F4F6', text: '#9CA3AF' }
}

const DEFAULT_STATE: AppState = {
  weekStart: getMondayOf(new Date()),
  pins: { KTC: '1111', ACF: '2222', GM: '3333', CEO: '4444' },
  dayOff: { KTC: [6], ACF: [0, 1], GM: [], CEO: [] },
  taskStatus: {},
  taskOverrides: {},
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMondayOf(d: Date): string {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(d)
  mon.setDate(d.getDate() + diff)
  return mon.toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function overrideKey(weekStart: string, taskIdx: number, dayIdx: number): string {
  return `${weekStart}_${taskIdx}_${dayIdx}`
}

function taskStatusKey(weekStart: string, role: Role, taskIdx: number, dayIdx: number): string {
  return `${weekStart}_${role}_${taskIdx}_${dayIdx}`
}

function getAssignee(state: AppState, taskIdx: number, dayIdx: number): Assignee {
  const key = overrideKey(state.weekStart, taskIdx, dayIdx)
  return state.taskOverrides[key] ?? TASKS[taskIdx].days[dayIdx]
}

function isVisibleTo(assignee: Assignee, role: Role): boolean {
  if (assignee === '-') return false
  if (assignee === 'Anyone Free' || assignee === 'All Staff') return role !== 'CEO'
  return assignee === role
}

function loadState(): AppState {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const raw = localStorage.getItem('himmapun_state')
    if (!raw) return { ...DEFAULT_STATE }
    const saved = JSON.parse(raw) as Partial<AppState>
    return {
      weekStart:     saved.weekStart     ?? DEFAULT_STATE.weekStart,
      pins:          { ...DEFAULT_STATE.pins,  ...saved.pins },
      dayOff:        { ...DEFAULT_STATE.dayOff, ...saved.dayOff },
      taskStatus:    saved.taskStatus    ?? {},
      taskOverrides: saved.taskOverrides ?? {},
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

function saveState(s: AppState) {
  localStorage.setItem('himmapun_state', JSON.stringify(s))
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const NAV_GREEN = '#1B4332'

const S: Record<string, React.CSSProperties> = {
  page:    { minHeight: '100vh', background: '#F4F6F3', fontFamily: '"DM Sans", sans-serif', color: '#1a1a1a' },
  nav:     { background: NAV_GREEN, color: '#fff', padding: '0 16px', position: 'sticky', top: 0, zIndex: 50 },
  navRow:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '52px' },
  tabBar:  { display: 'flex', borderTop: '1px solid rgba(255,255,255,0.15)' },
  tab:     { flex: 1, padding: '10px 0', fontSize: '12px', textAlign: 'center' as const, cursor: 'pointer', border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.65)', fontFamily: '"DM Sans", sans-serif' },
  tabActive: { color: '#fff', borderBottom: '2px solid #C8E84A' },
  body:    { padding: '16px', maxWidth: '680px', margin: '0 auto' },
  card:    { background: '#fff', borderRadius: '12px', padding: '16px', marginBottom: '10px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  pill:    { display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 600 },
  btn:     { border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', fontFamily: '"DM Sans", sans-serif' },
  input:   { border: '1px solid #D1D5DB', borderRadius: '8px', padding: '10px 12px', fontSize: '15px', width: '100%', boxSizing: 'border-box' as const, fontFamily: '"DM Sans", sans-serif' },
  label:   { fontSize: '12px', color: '#6B7280', marginBottom: '4px', display: 'block', fontWeight: 500 },
  sectionLabel: { fontSize: '11px', fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: '8px', marginTop: '16px' },
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (role: Role) => void }) {
  const [selected, setSelected] = useState<Role | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [state] = useState(loadState)

  function attempt() {
    if (!selected) { setError('Please choose your role first.'); return }
    if (pin === state.pins[selected]) {
      sessionStorage.setItem('staff_role', selected)
      onLogin(selected)
    } else {
      setError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: NAV_GREEN, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', fontFamily: '"Fraunces", serif' }}>Himmapun Retreat</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', marginTop: '4px' }}>Staff Portal</div>
      </div>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '360px' }}>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px', marginTop: 0 }}>Select your role</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '20px' }}>
          {ROLES.map(r => {
            const c = ROLE_COLORS[r]
            const active = selected === r
            return (
              <button key={r} onClick={() => { setSelected(r); setError('') }}
                style={{ padding: '12px', borderRadius: '10px', border: `2px solid ${active ? c.dark : '#E5E7EB'}`, background: active ? c.bg : '#F9FAFB', cursor: 'pointer', textAlign: 'left' }}>
                <div style={{ fontSize: '15px', fontWeight: 700, color: c.dark }}>{r}</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{ROLE_NAMES[r]}</div>
              </button>
            )
          })}
        </div>
        <label style={S.label}>PIN</label>
        <input type="password" inputMode="numeric" maxLength={4} value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 4)); setError('') }}
          onKeyDown={e => e.key === 'Enter' && attempt()}
          placeholder="••••"
          style={{ ...S.input, fontSize: '24px', letterSpacing: '0.3em', textAlign: 'center', marginBottom: '12px' }}
          autoFocus />
        {error && <div style={{ background: '#FEF2F2', color: '#991B1B', padding: '8px 12px', borderRadius: '8px', fontSize: '13px', marginBottom: '10px' }}>{error}</div>}
        <button onClick={attempt} style={{ ...S.btn, background: NAV_GREEN, color: '#fff', width: '100%', padding: '13px' }}>
          Enter Portal
        </button>
      </div>
    </div>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell({ role, onSignOut }: { role: Role; onSignOut: () => void }) {
  const [tab, setTab] = useState<AppTab>('tasks')
  const [state, setState] = useState<AppState>(loadState)
  const c = ROLE_COLORS[role]

  function updateState(patch: Partial<AppState>) {
    setState(prev => {
      const next = { ...prev, ...patch }
      saveState(next)
      return next
    })
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i))

  const tabs: { id: AppTab; label: string }[] = [
    { id: 'tasks',    label: 'My Tasks' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'bookings', label: 'This Week' },
    { id: 'settings', label: 'Settings' },
  ]

  return (
    <div style={S.page}>
      <nav style={S.nav}>
        <div style={S.navRow}>
          <div style={{ fontFamily: '"Fraunces", serif', fontSize: '16px', fontWeight: 600 }}>Himmapun</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ ...S.pill, background: c.tag, color: c.dark }}>{role}</span>
            <button onClick={onSignOut} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}>Sign out</button>
          </div>
        </div>
        <div style={S.tabBar}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}>
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <div style={tab === 'schedule' ? { padding: '0', maxWidth: '100%' } : S.body}>
        {tab === 'tasks'    && <TasksTab role={role} state={state} weekDates={weekDates} updateState={updateState} />}
        {tab === 'schedule' && <ScheduleTab role={role} state={state} weekDates={weekDates} updateState={updateState} />}
        {tab === 'bookings' && <BookingsTab weekDates={weekDates} />}
        {tab === 'settings' && <SettingsTab role={role} state={state} updateState={updateState} />}
      </div>
    </div>
  )
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ role, state, weekDates, updateState }: {
  role: Role; state: AppState; weekDates: string[]
  updateState: (p: Partial<AppState>) => void
}) {
  const today = todayStr()
  const defaultDay = weekDates.includes(today) ? today : weekDates[0]
  const [selectedDate, setSelectedDate] = useState(defaultDay)
  const dayIdx = weekDates.indexOf(selectedDate)
  const isDayOff = state.dayOff[role].includes(dayIdx)

  const visibleTasks = TASKS.map((t, i) => ({ task: t, idx: i }))
    .filter(({ idx }) => isVisibleTo(getAssignee(state, idx, dayIdx), role))

  const sections = ['Accommodation & Farm', 'Kitchen', 'Office'] as const

  function getStatus(taskIdx: number): TaskStatus {
    return state.taskStatus[taskStatusKey(state.weekStart, role, taskIdx, dayIdx)] ?? 'pending'
  }

  function setStatus(taskIdx: number, status: TaskStatus) {
    const k = taskStatusKey(state.weekStart, role, taskIdx, dayIdx)
    updateState({ taskStatus: { ...state.taskStatus, [k]: status } })
  }

  const done      = visibleTasks.filter(({ idx }) => getStatus(idx) === 'done').length
  const total     = visibleTasks.length
  const remaining = visibleTasks.filter(({ idx }) => getStatus(idx) === 'pending').length
  const pct       = total === 0 ? 0 : Math.round((done / total) * 100)

  return (
    <>
      {/* Day strip */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px', scrollbarWidth: 'none' }}>
        {weekDates.map((date, i) => {
          const off    = state.dayOff[role].includes(i)
          const isToday = date === today
          const active  = date === selectedDate
          return (
            <button key={date} onClick={() => setSelectedDate(date)} style={{
              flex: '0 0 auto', minWidth: '60px', padding: '8px 4px', borderRadius: '10px', border: 'none',
              background: active ? NAV_GREEN : off ? '#FECACA' : isToday ? '#E8F5E9' : '#fff',
              color: active ? '#fff' : off ? '#991B1B' : '#1a1a1a', cursor: 'pointer', textAlign: 'center',
              boxShadow: active ? '0 2px 8px rgba(27,67,50,0.3)' : '0 1px 3px rgba(0,0,0,0.06)',
              outline: isToday && !active ? `2px solid ${NAV_GREEN}` : 'none',
            }}>
              <div style={{ fontSize: '11px', fontWeight: 600 }}>{DAY_NAMES[i]}</div>
              <div style={{ fontSize: '13px', marginTop: '2px' }}>{formatDay(date)}</div>
              {off && <div style={{ fontSize: '9px', marginTop: '2px', fontWeight: 700 }}>OFF</div>}
            </button>
          )
        })}
      </div>

      {isDayOff ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌿</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>Your day off</div>
          <div style={{ fontSize: '14px', color: '#6B7280' }}>Enjoy your rest. The team has it covered today.</div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {[['Done', done, '#22C55E'], ['Remaining', remaining, '#F59E0B'], ['Total', total, '#1a1a1a']].map(([label, val, color]) => (
              <div key={label as string} style={{ ...S.card, textAlign: 'center', marginBottom: 0, padding: '12px 8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: color as string }}>{val}</div>
                <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{label}</div>
              </div>
            ))}
          </div>
          {/* Progress */}
          <div style={{ height: '6px', background: '#E5E7EB', borderRadius: '3px', marginBottom: '16px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: '#22C55E', borderRadius: '3px', transition: 'width 0.3s' }} />
          </div>

          {sections.map(section => {
            const sectionTasks = visibleTasks.filter(({ task }) => task.section === section)
            if (sectionTasks.length === 0) return null
            return (
              <div key={section}>
                <div style={S.sectionLabel}>{section}</div>
                {sectionTasks.map(({ task, idx }) => (
                  <TaskCard key={idx} task={task} taskIdx={idx} dayIdx={dayIdx}
                    status={getStatus(idx)} onSetStatus={s => setStatus(idx, s)} />
                ))}
              </div>
            )
          })}

          {visibleTasks.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', color: '#6B7280', padding: '32px' }}>
              No tasks assigned for this day.
            </div>
          )}
        </>
      )}
    </>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, taskIdx, dayIdx, status, onSetStatus }: {
  task: typeof TASKS[number]; taskIdx: number; dayIdx: number
  status: TaskStatus; onSetStatus: (s: TaskStatus) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const assignee = task.days[dayIdx]
  const isShared = assignee === 'Anyone Free' || assignee === 'All Staff'
  const isDone   = status === 'done'
  const isDimmed = status === 'skipped' || status === 'na'

  return (
    <div style={{ ...S.card, padding: '0', overflow: 'hidden', opacity: isDimmed ? 0.55 : 1, border: isDone ? '1px solid #BBF7D0' : '1px solid transparent' }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', minHeight: '44px' }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#22C55E' : '#fff', border: isDone ? 'none' : '2px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isDone && <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>✓</span>}
        </div>
        <div style={{ flex: 1, fontSize: '14px', fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#9CA3AF' : '#1a1a1a' }}>
          {task.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {isShared && <span style={{ ...S.pill, background: '#FEF9C3', color: '#92400E', fontSize: '10px' }}>shared</span>}
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{task.time}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: '6px', padding: '0 16px 14px', borderTop: '1px solid #F3F4F6' }}>
          <ActionBtn label="Done"  color="#22C55E" active={status === 'done'}    onClick={() => { onSetStatus(status === 'done'    ? 'pending' : 'done');    setExpanded(false) }} />
          <ActionBtn label="Skip"  color="#F59E0B" active={status === 'skipped'} onClick={() => { onSetStatus(status === 'skipped' ? 'pending' : 'skipped'); setExpanded(false) }} />
          <ActionBtn label="N/A"   color="#9CA3AF" active={status === 'na'}      onClick={() => { onSetStatus(status === 'na'      ? 'pending' : 'na');      setExpanded(false) }} />
          {status !== 'pending' && (
            <ActionBtn label="Undo" color="#EF4444" active={false} onClick={() => { onSetStatus('pending'); setExpanded(false) }} />
          )}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ label, color, active, onClick }: { label: string; color: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ ...S.btn, padding: '8px 14px', fontSize: '13px', background: active ? color : '#F9FAFB', color: active ? '#fff' : color, border: `1px solid ${active ? color : '#E5E7EB'}`, minHeight: '44px' }}>
      {label}
    </button>
  )
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────

function ScheduleTab({ role, state, weekDates, updateState }: {
  role: Role; state: AppState; weekDates: string[]
  updateState: (p: Partial<AppState>) => void
}) {
  const canEdit = role === 'GM' || role === 'CEO'
  const [activeCell, setActiveCell] = useState<{ taskIdx: number; dayIdx: number } | null>(null)
  const today = todayStr()
  const sections = ['Accommodation & Farm', 'Kitchen', 'Office'] as const

  function setAssignee(taskIdx: number, dayIdx: number, value: Assignee) {
    const key = overrideKey(state.weekStart, taskIdx, dayIdx)
    const next = { ...state.taskOverrides }
    if (value === TASKS[taskIdx].days[dayIdx]) {
      delete next[key] // revert to default — no need to store
    } else {
      next[key] = value
    }
    updateState({ taskOverrides: next })
    setActiveCell(null)
  }

  function resetAll() {
    if (!confirm('Reset all assignments to defaults for this week?')) return
    updateState({ taskOverrides: {} })
  }

  const TASK_COL_W = 140
  const DAY_COL_W  = 100

  return (
    <div>
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fff', borderBottom: '1px solid #E5E7EB', position: 'sticky', top: 104, zIndex: 40 }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>Weekly Task Planner</div>
          <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '1px' }}>
            {formatDay(weekDates[0])} – {formatDay(weekDates[6])}
            {canEdit ? '  ·  Tap any cell to reassign' : '  ·  View only'}
          </div>
        </div>
        {canEdit && (
          <button onClick={resetAll} style={{ ...S.btn, fontSize: '12px', padding: '6px 12px', background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA' }}>
            Reset all
          </button>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px 16px', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
        {ALL_ASSIGNEES.map(a => {
          if (a === '-') return null
          const st = assigneeStyle(a)
          return <span key={a} style={{ ...S.pill, background: st.bg, color: st.text, fontSize: '10px' }}>{a}</span>
        })}
      </div>

      {/* Scrollable table */}
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: `${TASK_COL_W + DAY_COL_W * 7}px`, width: '100%' }}>
          {/* Column header */}
          <thead>
            <tr style={{ background: NAV_GREEN }}>
              <th style={{ width: TASK_COL_W, minWidth: TASK_COL_W, padding: '10px 12px', textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#fff', position: 'sticky', left: 0, background: NAV_GREEN, zIndex: 10 }}>
                Task
              </th>
              {weekDates.map((date, i) => (
                <th key={date} style={{
                  width: DAY_COL_W, minWidth: DAY_COL_W, padding: '8px 6px', textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#fff',
                  background: date === today ? '#2D6A4F' : NAV_GREEN,
                  outline: date === today ? '2px inset #C8E84A' : 'none',
                }}>
                  <div>{DAY_NAMES[i]}</div>
                  <div style={{ fontWeight: 400, opacity: 0.8, marginTop: '1px' }}>{formatDay(date)}</div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sections.map(section => {
              const sectionTasks = TASKS.map((t, i) => ({ task: t, idx: i })).filter(({ task }) => task.section === section)
              return (
                <>
                  {/* Section header row */}
                  <tr key={`sec-${section}`} style={{ background: '#E8F5E9' }}>
                    <td colSpan={8} style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700, color: '#1B4332', letterSpacing: '0.06em', textTransform: 'uppercase', position: 'sticky', left: 0 }}>
                      {section}
                    </td>
                  </tr>

                  {sectionTasks.map(({ task, idx }) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #F3F4F6' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>

                      {/* Task name — sticky left */}
                      <td style={{
                        padding: '8px 12px', fontSize: '12px', fontWeight: 500, color: '#374151',
                        position: 'sticky', left: 0, background: '#fff', zIndex: 5,
                        borderRight: '1px solid #E5E7EB', maxWidth: TASK_COL_W,
                      }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={task.name}>
                          {task.name}
                        </div>
                        <div style={{ fontSize: '10px', color: '#9CA3AF', marginTop: '2px' }}>{task.time}</div>
                      </td>

                      {/* Day cells */}
                      {weekDates.map((date, dayIdx) => {
                        const assignee = getAssignee(state, idx, dayIdx)
                        const isOff    = assignee === '-'
                        const st       = assigneeStyle(assignee)
                        const isActive = activeCell?.taskIdx === idx && activeCell?.dayIdx === dayIdx
                        const isOverridden = !!state.taskOverrides[overrideKey(state.weekStart, idx, dayIdx)]
                        const isDayOff_col = state.dayOff['KTC'].includes(dayIdx) && state.dayOff['ACF'].includes(dayIdx) && state.dayOff['GM'].includes(dayIdx)

                        return (
                          <td key={dayIdx} style={{ padding: '4px', textAlign: 'center', verticalAlign: 'middle', background: isActive ? '#FFF9C4' : undefined }}
                            onClick={() => {
                              if (!canEdit) return
                              setActiveCell(isActive ? null : { taskIdx: idx, dayIdx })
                            }}>

                            {isActive && canEdit ? (
                              /* Inline picker */
                              <div style={{ position: 'relative', zIndex: 20 }}>
                                <div style={{ position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)', background: '#fff', border: '1px solid #D1D5DB', borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', padding: '6px', zIndex: 30, minWidth: '120px' }}>
                                  {ALL_ASSIGNEES.map(opt => {
                                    const os = assigneeStyle(opt)
                                    const isCurrent = assignee === opt
                                    return (
                                      <button key={opt} onClick={e => { e.stopPropagation(); setAssignee(idx, dayIdx, opt) }}
                                        style={{ display: 'block', width: '100%', padding: '7px 10px', textAlign: 'left', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: isCurrent ? 700 : 400, background: isCurrent ? os.bg : 'transparent', color: isCurrent ? os.text : '#374151', marginBottom: '2px', fontFamily: '"DM Sans", sans-serif' }}>
                                        {opt === '-' ? '— nobody —' : opt}
                                        {opt === TASKS[idx].days[dayIdx] && <span style={{ fontSize: '10px', color: '#9CA3AF', marginLeft: '4px' }}>(default)</span>}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                minWidth: '72px', padding: '5px 6px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                background: isOff ? '#F3F4F6' : st.bg, color: isOff ? '#D1D5DB' : st.text,
                                cursor: canEdit ? 'pointer' : 'default',
                                border: isOverridden ? '1.5px dashed currentColor' : '1px solid transparent',
                                opacity: isDayOff_col ? 0.5 : 1,
                              }}>
                                {isOff ? '—' : assignee}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Close picker on outside click */}
      {activeCell && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 15 }} onClick={() => setActiveCell(null)} />
      )}

      {canEdit && (
        <div style={{ padding: '12px 16px', fontSize: '11px', color: '#9CA3AF' }}>
          Dashed border = overridden from default · Changes apply immediately to staff&apos;s My Tasks.
        </div>
      )}
    </div>
  )
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({ weekDates }: { weekDates: string[] }) {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading]   = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('bookings')
      .select('id,guest,guest2,room,checkin,checkout,nights,status,passport_url,passport_uploaded_at,guest2_passport_url,guest2_passport_uploaded_at,booking_ref')
      .or(`and(checkin.gte.${weekDates[0]},checkin.lte.${weekDates[6]}),and(checkout.gte.${weekDates[0]},checkout.lte.${weekDates[6]})`)
      .in('status', ['Upcoming', 'Check-in', 'Occupied', 'Checkout'])
      .order('checkin')
    setBookings((data ?? []) as Booking[])
    setLoading(false)
  }, [weekDates])

  useEffect(() => { load() }, [load])

  const checkIns  = weekDates.map(d => bookings.filter(b => b.checkin  === d))
  const checkOuts = weekDates.map(d => bookings.filter(b => b.checkout === d))

  return (
    <>
      <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '4px' }}>This Week</div>
      <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
        {formatDay(weekDates[0])} – {formatDay(weekDates[6])}
      </div>

      {loading ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#6B7280', padding: '32px' }}>Loading…</div>
      ) : bookings.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#6B7280', padding: '32px' }}>No arrivals or departures this week.</div>
      ) : (
        weekDates.map((date, i) => {
          const ins  = checkIns[i]
          const outs = checkOuts[i]
          if (ins.length === 0 && outs.length === 0) return null
          return (
            <div key={date}>
              <div style={S.sectionLabel}>{DAY_FULL[i]} · {formatDay(date)}</div>
              {ins.map(b  => <BookingCard key={`in-${b.id}`}  booking={b} type="checkin"  onRefresh={load} />)}
              {outs.map(b => <BookingCard key={`out-${b.id}`} booking={b} type="checkout" onRefresh={load} />)}
            </div>
          )
        })
      )}
    </>
  )
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ booking, type, onRefresh }: { booking: Booking; type: 'checkin' | 'checkout'; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [guest2, setGuest2]     = useState(booking.guest2 ?? '')
  const [saving, setSaving]     = useState(false)
  const [scanMsg, setScanMsg]   = useState('')
  const [scan2Msg, setScan2Msg] = useState('')
  const p1Ref = useRef<HTMLInputElement>(null)
  const p2Ref = useRef<HTMLInputElement>(null)
  const isCheckIn  = type === 'checkin'
  const badgeColor = isCheckIn ? { bg: '#DCFCE7', text: '#166534' } : { bg: '#FEF3C7', text: '#92400E' }

  async function saveGuest2() {
    setSaving(true)
    await createClient().from('bookings').update({ guest2 }).eq('id', booking.id)
    setSaving(false)
  }

  async function uploadPassport(file: File, guestNum: 1 | 2) {
    const setMsg = guestNum === 1 ? setScanMsg : setScan2Msg
    setMsg('Uploading…')
    const supabase = createClient()
    const blob = await toJpeg(file)
    const path = `${booking.id}/guest${guestNum}_${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage.from(PASSPORT_BUCKET).upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
    if (upErr) { setMsg('Upload failed'); return }
    const field   = guestNum === 1 ? 'passport_url'         : 'guest2_passport_url'
    const tsField = guestNum === 1 ? 'passport_uploaded_at' : 'guest2_passport_uploaded_at'
    await supabase.from('bookings').update({ [field]: path, [tsField]: new Date().toISOString() }).eq('id', booking.id)
    setMsg('Scanning passport…')
    try {
      const b64 = await blobToBase64(blob)
      const res = await fetch('/api/extract-passport', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageBase64: b64, mediaType: 'image/jpeg' }) })
      if (res.ok) {
        const d = await res.json() as { name?: string; passport_number?: string }
        const parts: string[] = []
        if (d.name) parts.push(d.name)
        if (d.passport_number) parts.push(`#${d.passport_number}`)
        setMsg(parts.length ? `✓ ${parts.join(' · ')}` : '✓ Uploaded')
      } else { setMsg('✓ Uploaded (scan unavailable)') }
    } catch { setMsg('✓ Uploaded (scan unavailable)') }
    onRefresh()
  }

  async function viewPassport(guestNum: 1 | 2) {
    const path = guestNum === 1 ? booking.passport_url : booking.guest2_passport_url
    if (!path) return
    const { data } = await createClient().storage.from(PASSPORT_BUCKET).createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <div style={{ ...S.card, padding: '0', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ ...S.pill, background: badgeColor.bg, color: badgeColor.text }}>
              {isCheckIn ? '↓ Check-in' : '↑ Checkout'}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{booking.room}</span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{booking.guest}</div>
          {booking.guest2 && <div style={{ fontSize: '13px', color: '#6B7280' }}>{booking.guest2}</div>}
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
            {booking.checkin} → {booking.checkout} · {booking.nights} night{booking.nights !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ fontSize: '18px', color: '#9CA3AF', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #F3F4F6', padding: '14px 16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>Second guest name (optional)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={guest2} onChange={e => setGuest2(e.target.value)} placeholder="Full name" style={{ ...S.input, flex: 1 }} />
              <button onClick={saveGuest2} disabled={saving}
                style={{ ...S.btn, background: NAV_GREEN, color: '#fff', padding: '10px 14px', fontSize: '13px', flexShrink: 0 }}>
                {saving ? '…' : 'Save'}
              </button>
            </div>
          </div>
          <PassportRow label={`${booking.guest}'s Passport`} hasPhoto={!!booking.passport_url}
            uploadedAt={booking.passport_uploaded_at} scanMsg={scanMsg} inputRef={p1Ref}
            onView={() => viewPassport(1)} onFile={f => uploadPassport(f, 1)} />
          {(booking.guest2 || guest2) && (
            <PassportRow label={`${booking.guest2 || guest2}'s Passport`} hasPhoto={!!booking.guest2_passport_url}
              uploadedAt={booking.guest2_passport_uploaded_at} scanMsg={scan2Msg} inputRef={p2Ref}
              onView={() => viewPassport(2)} onFile={f => uploadPassport(f, 2)} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Passport Row ─────────────────────────────────────────────────────────────

function PassportRow({ label, hasPhoto, uploadedAt, scanMsg, inputRef, onView, onFile }: {
  label: string; hasPhoto: boolean; uploadedAt: string | null; scanMsg: string
  inputRef: React.RefObject<HTMLInputElement | null>; onView: () => void; onFile: (f: File) => void
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={S.label}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => inputRef.current?.click()}
          style={{ ...S.btn, background: '#F3F4F6', color: '#1a1a1a', fontSize: '13px', padding: '9px 14px', minHeight: '44px' }}>
          {hasPhoto ? '📷 Replace' : '📷 Take / Upload'}
        </button>
        {hasPhoto && (
          <button onClick={onView} style={{ ...S.btn, background: '#EFF6FF', color: '#1E40AF', fontSize: '13px', padding: '9px 14px', minHeight: '44px' }}>
            View
          </button>
        )}
        {scanMsg && <span style={{ fontSize: '12px', color: scanMsg.startsWith('✓') ? '#166534' : '#6B7280' }}>{scanMsg}</span>}
        {hasPhoto && uploadedAt && !scanMsg && (
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>
            ✓ {new Date(uploadedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}
      </div>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = '' }} />
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ role, state, updateState }: {
  role: Role; state: AppState; updateState: (p: Partial<AppState>) => void
}) {
  const [newPin, setNewPin]   = useState('')
  const [pinSaved, setPinSaved] = useState(false)

  function savePin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) return
    updateState({ pins: { ...state.pins, [role]: newPin } })
    setNewPin('')
    setPinSaved(true)
    setTimeout(() => setPinSaved(false), 2000)
  }

  function toggleDayOff(r: Role, dayIdx: number) {
    const current = state.dayOff[r]
    const next    = current.includes(dayIdx) ? current.filter(d => d !== dayIdx) : [...current, dayIdx]
    updateState({ dayOff: { ...state.dayOff, [r]: next } })
  }

  return (
    <>
      <div style={S.card}>
        <div style={{ fontWeight: 600, marginBottom: '10px' }}>Week Start</div>
        <label style={S.label}>Monday of current week</label>
        <input type="date" value={state.weekStart}
          onChange={e => { const d = new Date(e.target.value + 'T00:00:00'); if (d.getDay() === 1) updateState({ weekStart: e.target.value }) }}
          style={S.input} />
        <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }}>Must be a Monday. Changing this resets task statuses.</div>
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 600, marginBottom: '12px' }}>Day-Off Roster</div>
        {ROLES.map(r => {
          const c = ROLE_COLORS[r]
          return (
            <div key={r} style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: c.dark, marginBottom: '6px' }}>{r} — {ROLE_NAMES[r]}</div>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {DAY_NAMES.map((day, i) => {
                  const off = state.dayOff[r].includes(i)
                  return (
                    <button key={i} onClick={() => toggleDayOff(r, i)} style={{ ...S.btn, padding: '6px 10px', fontSize: '12px', minHeight: '44px', background: off ? '#FEE2E2' : '#F3F4F6', color: off ? '#991B1B' : '#374151', border: `1px solid ${off ? '#FECACA' : '#E5E7EB'}` }}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div style={S.card}>
        <div style={{ fontWeight: 600, marginBottom: '10px' }}>Change Your PIN ({role})</div>
        <label style={S.label}>New 4-digit PIN</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="password" inputMode="numeric" maxLength={4} value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••" style={{ ...S.input, flex: 1, letterSpacing: '0.3em', textAlign: 'center', fontSize: '20px' }} />
          <button onClick={savePin} style={{ ...S.btn, background: NAV_GREEN, color: '#fff', flexShrink: 0 }}>Save</button>
        </div>
        {pinSaved && <div style={{ color: '#166534', fontSize: '13px', marginTop: '8px' }}>✓ PIN updated</div>}
      </div>
    </>
  )
}

// ─── Image helpers ────────────────────────────────────────────────────────────

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  let { width: w, height: h } = bitmap
  const MAX = 1600
  if (w > MAX || h > MAX) {
    if (w > h) { h = Math.round(h * MAX / w); w = MAX }
    else        { w = Math.round(w * MAX / h); h = MAX }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  return new Promise((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', 0.88)
  )
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => { const s = r.result as string; res(s.slice(s.indexOf(',') + 1)) }
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function StaffPortal() {
  const [role, setRole]       = useState<Role | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = sessionStorage.getItem('staff_role') as Role | null
    if (saved && ROLES.includes(saved)) setRole(saved)
  }, [])

  if (!mounted) return null

  function signOut() {
    sessionStorage.removeItem('staff_role')
    setRole(null)
  }

  if (!role) return <LoginScreen onLogin={setRole} />
  return <AppShell role={role} onSignOut={signOut} />
}
