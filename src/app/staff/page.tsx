'use client'

import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TASKS, timeToSlot, SLOT_LABELS } from './tasks'
import type { Assignee } from './tasks'

// ─── Types ────────────────────────────────────────────────────────────────────

type Role       = 'KTC' | 'ACF' | 'GM' | 'CEO'
type TaskStatus = 'pending' | 'done' | 'skipped' | 'na'
type AppTab     = 'tasks' | 'bookings' | 'settings'
type Lang       = 'en' | 'th'

interface NoDeadlineCustomTask {
  id: string
  name: string
  section: 'Accommodation & Farm' | 'Kitchen' | 'Office'
  slot?: string
  time?: string
  instructions: string[]
  noDeadline?: boolean
}

interface AppState {
  weekStart: string
  pins: Record<Role, string>
  dayOff: Record<Role, number[]>
  taskStatus: Record<string, TaskStatus>
  taskOverrides: Record<string, Assignee>
}

interface Booking {
  id: number
  guest: string; guest2: string; room: string
  checkin: string; checkout: string; nights: number; status: string
  passport_url: string | null; passport_uploaded_at: string | null
  guest2_passport_url: string | null; guest2_passport_uploaded_at: string | null
  booking_ref: string
}

interface LeaveRequest {
  id: string
  role: Role
  type: 'day-off-change' | 'leave' | 'emergency'
  date: string
  swapDate?: string
  reason: string
  proofPath?: string
  submittedAt: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNote?: string
}

// ─── Translations ─────────────────────────────────────────────────────────────

const TX = {
  en: {
    myTasks: 'My Tasks', guests: 'Guests', settings: 'Settings', signOut: 'Sign out',
    yourDayOff: 'Your day off',
    dayOffMsg: 'Enjoy your rest. The team has it covered today.',
    done: 'Done', skip: 'Skip', na: 'N/A', undo: 'Undo',
    remaining: 'Remaining', total: 'Total',
    noTasksDay: 'No tasks assigned for this day.',
    openTasks: 'Open tasks',
    monthlyRoster: 'Monthly Roster',
    rosterNote: (canEdit: boolean): string => canEdit ? 'Tap a day to toggle recurring day-off. Dashed = approved leave.' : 'Colored tags = day off · Dashed border = approved leave',
    dayShort: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
    months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
    monthShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
    requestLeave: 'Request Leave / Day Off',
    rulesBefore: '📋 Policy — please read before submitting',
    rules: [
      'Day-off change must be requested at least 30 days in advance.',
      'Regular leave must be requested at least 7 days in advance.',
      'Emergency leave: max 3 times per year · proof document required.',
    ],
    emergencyUsed: (n: number) => `Emergency leave used this year: ${n} / 3`,
    iUnderstand: 'I understand — continue',
    leaveType: 'Request type',
    typeDayOff: 'Day-off change', typeLeave: 'Regular leave', typeEmergency: 'Emergency leave',
    leaveDate: 'Date', swapDate: 'Swap with date', reason: 'Reason',
    proofDoc: 'Upload proof (required)',
    uploadFile: 'Upload file', fileUploaded: '✓ File uploaded',
    submit: 'Submit Request', submitted: '✓ Request submitted',
    validDayOff: (d: number) => `⚠ Must be at least 30 days from today (${d} more day${d !== 1 ? 's' : ''} needed)`,
    validLeave: (d: number) => `⚠ Must be at least 7 days from today (${d} more day${d !== 1 ? 's' : ''} needed)`,
    validEmergency: '⚠ You have used all 3 emergency leaves this year',
    pendingRequests: 'Pending Requests', noPending: 'No pending requests.',
    approve: 'Approve', reject: 'Reject', reviewNotePlaceholder: 'Optional note…',
    myRequests: 'My Requests', noRequests: 'No requests yet.',
    sPending: 'Pending', sApproved: 'Approved', sRejected: 'Rejected',
    changePin: (r: string) => `Change Your PIN (${r})`,
    newPin: 'New 4-digit PIN', savePIN: 'Save', pinSaved: '✓ PIN updated',
    himmapunGuests: 'Himmapun Guests', today: 'Today',
    loading: 'Loading…', noArrivals: 'No arrivals or departures this week.',
    checkIn: '↓ Check-in', checkOut: '↑ Checkout',
    nights: (n: number) => `${n} night${n !== 1 ? 's' : ''}`,
    secondGuest: 'Second guest name (optional)', save: 'Save', view: 'View',
    takeUpload: '📷 Take / Upload', replace: '📷 Replace',
  },
  th: {
    myTasks: 'งานของฉัน', guests: 'แขก', settings: 'ตั้งค่า', signOut: 'ออกจากระบบ',
    yourDayOff: 'วันหยุดของคุณ',
    dayOffMsg: 'พักผ่อนให้เต็มที่ ทีมงานดูแลแทนแล้ว',
    done: 'เสร็จ', skip: 'ข้าม', na: 'ไม่เกี่ยว', undo: 'ยกเลิก',
    remaining: 'คงเหลือ', total: 'รวม',
    noTasksDay: 'ไม่มีงานที่มอบหมายในวันนี้',
    openTasks: 'งานเปิด',
    monthlyRoster: 'ตารางงานรายเดือน',
    rosterNote: (canEdit: boolean): string => canEdit ? 'แตะวันเพื่อเปิด/ปิดวันหยุดประจำ — เส้นประ = ลาที่อนุมัติแล้ว' : 'สีแสดงวันหยุด — เส้นประ = ลาที่อนุมัติ',
    dayShort: ['จ.','อ.','พ.','พฤ.','ศ.','ส.','อา.'],
    months: ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'],
    monthShort: ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'],
    requestLeave: 'ขอลา / เปลี่ยนวันหยุด',
    rulesBefore: '📋 กฎระเบียบ — กรุณาอ่านก่อนส่ง',
    rules: [
      'เปลี่ยนวันหยุด: ต้องแจ้งล่วงหน้าอย่างน้อย 30 วัน',
      'ลาพักร้อน: ต้องแจ้งล่วงหน้าอย่างน้อย 7 วัน',
      'ลาฉุกเฉิน: ไม่เกิน 3 ครั้งต่อปี ต้องมีเอกสารหลักฐาน',
    ],
    emergencyUsed: (n: number) => `ลาฉุกเฉินที่ใช้ไปปีนี้: ${n} / 3`,
    iUnderstand: 'รับทราบแล้ว — ดำเนินการต่อ',
    leaveType: 'ประเภท',
    typeDayOff: 'เปลี่ยนวันหยุด', typeLeave: 'ลาพักร้อน', typeEmergency: 'ลาฉุกเฉิน',
    leaveDate: 'วันที่', swapDate: 'เปลี่ยนเป็นวันที่', reason: 'เหตุผล',
    proofDoc: 'อัปโหลดหลักฐาน (จำเป็น)',
    uploadFile: 'อัปโหลดไฟล์', fileUploaded: '✓ อัปโหลดแล้ว',
    submit: 'ส่งคำขอ', submitted: '✓ ส่งคำขอแล้ว',
    validDayOff: (d: number) => `⚠ ต้องแจ้งล่วงหน้าอีก ${d} วัน (ครบ 30 วัน)`,
    validLeave: (d: number) => `⚠ ต้องแจ้งล่วงหน้าอีก ${d} วัน (ครบ 7 วัน)`,
    validEmergency: '⚠ คุณใช้ลาฉุกเฉินครบ 3 ครั้งแล้วในปีนี้',
    pendingRequests: 'คำขอรออนุมัติ', noPending: 'ไม่มีคำขอที่รออนุมัติ',
    approve: 'อนุมัติ', reject: 'ปฏิเสธ', reviewNotePlaceholder: 'หมายเหตุ (ถ้ามี)…',
    myRequests: 'คำขอของฉัน', noRequests: 'ยังไม่มีคำขอ',
    sPending: 'รอดำเนินการ', sApproved: 'อนุมัติแล้ว', sRejected: 'ปฏิเสธ',
    changePin: (r: string) => `เปลี่ยน PIN (${r})`,
    newPin: 'PIN 4 หลักใหม่', savePIN: 'บันทึก', pinSaved: '✓ อัปเดต PIN แล้ว',
    himmapunGuests: 'แขกหิมพานต์', today: 'วันนี้',
    loading: 'กำลังโหลด…', noArrivals: 'ไม่มีการเช็คอิน/เอาท์ในสัปดาห์นี้',
    checkIn: '↓ เช็คอิน', checkOut: '↑ เช็คเอาท์',
    nights: (n: number) => `${n} คืน`,
    secondGuest: 'ชื่อแขกคนที่ 2 (ถ้ามี)', save: 'บันทึก', view: 'ดู',
    takeUpload: '📷 ถ่าย / อัปโหลด', replace: '📷 เปลี่ยน',
  },
}
type TXType = typeof TX.en

const LangCtx = createContext<Lang>('en')
const useLang = () => useContext(LangCtx)

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES: Role[] = ['KTC', 'ACF', 'GM', 'CEO']
const ROLE_NAMES: Record<Role, string> = { KTC: 'Kitchen Staff', ACF: 'Wan', GM: 'General Manager', CEO: 'Co-Owner' }
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
  } catch { return { ...DEFAULT_STATE } }
}

function saveState(s: AppState) {
  try {
    const raw = localStorage.getItem('himmapun_state')
    const existing = raw ? JSON.parse(raw) : {}
    localStorage.setItem('himmapun_state', JSON.stringify({ ...existing, ...s }))
  } catch {}
}

function readLeaveRequests(): LeaveRequest[] {
  try {
    const raw = localStorage.getItem('himmapun_state')
    return raw ? (JSON.parse(raw).leaveRequests ?? []) : []
  } catch { return [] }
}

function writeLeaveRequests(reqs: LeaveRequest[]) {
  try {
    const raw = localStorage.getItem('himmapun_state')
    const existing = raw ? JSON.parse(raw) : {}
    localStorage.setItem('himmapun_state', JSON.stringify({ ...existing, leaveRequests: reqs }))
  } catch {}
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
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [lang, setLang]         = useState<Lang>(() => (typeof window !== 'undefined' ? (localStorage.getItem('himmapun_lang') as Lang) : null) ?? 'en')
  const [state]                 = useState(loadState)

  function attempt() {
    if (!selected) { setError(lang === 'en' ? 'Please choose your role first.' : 'กรุณาเลือกตำแหน่งก่อน'); return }
    if (pin === state.pins[selected]) {
      sessionStorage.setItem('staff_role', selected)
      onLogin(selected)
    } else {
      setError(lang === 'en' ? 'Incorrect PIN. Try again.' : 'PIN ไม่ถูกต้อง กรุณาลองใหม่')
      setPin('')
    }
  }

  function toggleLang() {
    const next = lang === 'en' ? 'th' : 'en'
    setLang(next)
    localStorage.setItem('himmapun_lang', next)
  }

  return (
    <div style={{ minHeight: '100vh', background: NAV_GREEN, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Language toggle */}
      <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
        <button onClick={toggleLang} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          {lang === 'en' ? 'TH' : 'EN'}
        </button>
      </div>

      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', fontFamily: '"Fraunces", serif' }}>Himmapun Retreat</div>
        <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', marginTop: '4px' }}>Staff Portal</div>
      </div>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '360px' }}>
        <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '14px', marginTop: 0 }}>
          {lang === 'en' ? 'Select your role' : 'เลือกตำแหน่งของคุณ'}
        </p>
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
          {lang === 'en' ? 'Enter Portal' : 'เข้าสู่ระบบ'}
        </button>
      </div>
    </div>
  )
}

// ─── App Shell ────────────────────────────────────────────────────────────────

function AppShell({ role, onSignOut }: { role: Role; onSignOut: () => void }) {
  const [tab, setTab]   = useState<AppTab>('tasks')
  const [state, setState] = useState<AppState>(loadState)
  const [lang, setLang] = useState<Lang>(() => (typeof window !== 'undefined' ? (localStorage.getItem('himmapun_lang') as Lang) : null) ?? 'en')
  const c = ROLE_COLORS[role]
  const T = TX[lang]

  function toggleLang() {
    const next = lang === 'en' ? 'th' : 'en'
    setLang(next)
    localStorage.setItem('himmapun_lang', next)
  }

  function updateState(patch: Partial<AppState>) {
    setState(prev => {
      const next = { ...prev, ...patch }
      saveState(next)
      return next
    })
  }

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(state.weekStart, i))

  const tabs: { id: AppTab; label: string }[] = [
    { id: 'tasks',    label: T.myTasks },
    { id: 'bookings', label: T.guests },
    { id: 'settings', label: T.settings },
  ]

  return (
    <LangCtx.Provider value={lang}>
      <div style={S.page}>
        <nav style={S.nav}>
          <div style={S.navRow}>
            <div style={{ fontFamily: '"Fraunces", serif', fontSize: '16px', fontWeight: 600 }}>Himmapun</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button onClick={toggleLang} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                {lang === 'en' ? 'TH' : 'EN'}
              </button>
              <span style={{ ...S.pill, background: c.tag, color: c.dark }}>{role}</span>
              <button onClick={onSignOut} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', borderRadius: '6px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}>{T.signOut}</button>
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

        <div style={S.body}>
          {tab === 'tasks'    && <TasksTab role={role} state={state} weekDates={weekDates} updateState={updateState} T={T} />}
          {tab === 'bookings' && <BookingsTab initialWeekStart={state.weekStart} T={T} />}
          {tab === 'settings' && <SettingsTab role={role} state={state} updateState={updateState} T={T} />}
        </div>
      </div>
    </LangCtx.Provider>
  )
}

// ─── Tasks Tab ────────────────────────────────────────────────────────────────

function TasksTab({ role, state, weekDates, updateState, T }: {
  role: Role; state: AppState; weekDates: string[]
  updateState: (p: Partial<AppState>) => void; T: TXType
}) {
  const today      = todayStr()
  const defaultDay = weekDates.includes(today) ? today : weekDates[0]
  const [selectedDate, setSelectedDate] = useState(defaultDay)
  const dayIdx   = weekDates.indexOf(selectedDate)
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
          const off     = state.dayOff[role].includes(i)
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
              <div style={{ fontSize: '11px', fontWeight: 600 }}>{T.dayShort[i]}</div>
              <div style={{ fontSize: '13px', marginTop: '2px' }}>{formatDay(date)}</div>
              {off && <div style={{ fontSize: '9px', marginTop: '2px', fontWeight: 700 }}>OFF</div>}
            </button>
          )
        })}
      </div>

      {isDayOff ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🌿</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>{T.yourDayOff}</div>
          <div style={{ fontSize: '14px', color: '#6B7280' }}>{T.dayOffMsg}</div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {([[T.done, done, '#22C55E'], [T.remaining, remaining, '#F59E0B'], [T.total, total, '#1a1a1a']] as [string, number, string][]).map(([label, val, color]) => (
              <div key={label} style={{ ...S.card, textAlign: 'center', marginBottom: 0, padding: '12px 8px' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color }}>{val}</div>
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
                    status={getStatus(idx)} onSetStatus={s => setStatus(idx, s)} T={T} />
                ))}
              </div>
            )
          })}

          {visibleTasks.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', color: '#6B7280', padding: '32px' }}>
              {T.noTasksDay}
            </div>
          )}

          <NoDeadlineSection role={role} state={state} updateState={updateState} T={T} />
        </>
      )}
    </>
  )
}

// ─── No Deadline Section (inside My Tasks) ────────────────────────────────────

function NoDeadlineSection({ role, state, updateState, T }: {
  role: Role; state: AppState; updateState: (p: Partial<AppState>) => void; T: TXType
}) {
  const [tasks, setTasks]       = useState<NoDeadlineCustomTask[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('himmapun_state')
      if (!raw) return
      const parsed = JSON.parse(raw) as { customTasks?: NoDeadlineCustomTask[] }
      setTasks((parsed.customTasks ?? []).filter(t => t.noDeadline))
    } catch {}
  }, [])

  if (tasks.length === 0) return null

  function statusKey(taskId: string) { return `nodl_${role}_${taskId}` }
  function getStatus(taskId: string): TaskStatus { return state.taskStatus[statusKey(taskId)] ?? 'pending' }
  function setTaskStatus(taskId: string, val: TaskStatus) {
    updateState({ taskStatus: { ...state.taskStatus, [statusKey(taskId)]: val } })
  }

  const slotLabel = (t: NoDeadlineCustomTask) => {
    if (t.slot) return SLOT_LABELS[t.slot as keyof typeof SLOT_LABELS] ?? t.slot
    if (t.time) return SLOT_LABELS[timeToSlot(t.time)]
    return ''
  }

  return (
    <>
      <div style={{ ...S.sectionLabel, marginTop: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {T.openTasks}
        <span style={{ ...S.pill, background: '#FEF9C3', color: '#92400E', fontSize: '10px' }}>{tasks.length}</span>
      </div>
      {tasks.map(t => {
        const s      = getStatus(t.id)
        const isDone   = s === 'done'
        const isDimmed = s === 'skipped' || s === 'na'
        const isOpen   = expanded === t.id
        return (
          <div key={t.id} style={{ ...S.card, padding: 0, overflow: 'hidden', opacity: isDimmed ? 0.55 : 1, border: isDone ? '1px solid #BBF7D0' : '1px solid transparent' }}>
            <div onClick={() => setExpanded(isOpen ? null : t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', cursor: 'pointer', minHeight: '44px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0, background: isDone ? '#22C55E' : '#fff', border: isDone ? 'none' : '2px solid #D1D5DB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isDone && <span style={{ color: '#fff', fontSize: '13px', fontWeight: 700 }}>✓</span>}
              </div>
              <div style={{ flex: 1, fontSize: '14px', fontWeight: 500, textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#9CA3AF' : '#1a1a1a' }}>{t.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                <span style={{ ...S.pill, background: '#F3F4F6', color: '#6B7280', fontSize: '10px' }}>no deadline</span>
                <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{slotLabel(t)}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ borderTop: '1px solid #F3F4F6', padding: '12px 16px' }}>
                {t.instructions && t.instructions.length > 0 && (
                  <ol style={{ margin: '0 0 12px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {t.instructions.map((step, i) => (
                      <li key={i} style={{ fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>{step}</li>
                    ))}
                  </ol>
                )}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <ActionBtn label={T.done}  color="#22C55E" active={s === 'done'}    onClick={() => { setTaskStatus(t.id, s === 'done'    ? 'pending' : 'done');    setExpanded(null) }} />
                  <ActionBtn label={T.skip}  color="#F59E0B" active={s === 'skipped'} onClick={() => { setTaskStatus(t.id, s === 'skipped' ? 'pending' : 'skipped'); setExpanded(null) }} />
                  <ActionBtn label={T.na}    color="#9CA3AF" active={s === 'na'}      onClick={() => { setTaskStatus(t.id, s === 'na'      ? 'pending' : 'na');      setExpanded(null) }} />
                  {s !== 'pending' && <ActionBtn label={T.undo} color="#EF4444" active={false} onClick={() => { setTaskStatus(t.id, 'pending'); setExpanded(null) }} />}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, taskIdx, dayIdx, status, onSetStatus, T }: {
  task: typeof TASKS[number]; taskIdx: number; dayIdx: number
  status: TaskStatus; onSetStatus: (s: TaskStatus) => void; T: TXType
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
          <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{SLOT_LABELS[timeToSlot(task.time)]}</span>
        </div>
      </div>
      {expanded && (
        <div style={{ display: 'flex', gap: '6px', padding: '0 16px 14px', borderTop: '1px solid #F3F4F6' }}>
          <ActionBtn label={T.done}  color="#22C55E" active={status === 'done'}    onClick={() => { onSetStatus(status === 'done'    ? 'pending' : 'done');    setExpanded(false) }} />
          <ActionBtn label={T.skip}  color="#F59E0B" active={status === 'skipped'} onClick={() => { onSetStatus(status === 'skipped' ? 'pending' : 'skipped'); setExpanded(false) }} />
          <ActionBtn label={T.na}    color="#9CA3AF" active={status === 'na'}      onClick={() => { onSetStatus(status === 'na'      ? 'pending' : 'na');      setExpanded(false) }} />
          {status !== 'pending' && (
            <ActionBtn label={T.undo} color="#EF4444" active={false} onClick={() => { onSetStatus('pending'); setExpanded(false) }} />
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

// ─── Weekly Roster Card ───────────────────────────────────────────────────────

const ROLE_DEPT: Record<Role, string> = {
  KTC: 'Kitchen', ACF: 'Accommodation', GM: 'Management', CEO: 'Management',
}

function MonthlyRosterCard({ role, state, updateState, T }: {
  role: Role; state: AppState; updateState: (p: Partial<AppState>) => void; T: TXType
}) {
  const today         = todayStr()
  const canEdit       = role === 'GM' || role === 'CEO'
  const currentMonday = getMondayOf(new Date())
  const scrollRef     = useRef<HTMLDivElement>(null)
  const currentRef    = useRef<HTMLDivElement>(null)
  const [leaveReqs, setLeaveReqs] = useState<LeaveRequest[]>([])

  useEffect(() => { setLeaveReqs(readLeaveRequests()) }, [])
  useEffect(() => {
    if (currentRef.current && scrollRef.current) {
      const top = currentRef.current.offsetTop - 8
      scrollRef.current.scrollTop = top
    }
  }, [])

  // 4 weeks back + current + 52 weeks forward = 57 weeks
  const weeks = Array.from({ length: 57 }, (_, i) => {
    const d = new Date(currentMonday + 'T00:00:00')
    d.setDate(d.getDate() + (i - 4) * 7)
    return d.toISOString().slice(0, 10)
  })

  function weekDates(monday: string): string[] {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday + 'T00:00:00')
      d.setDate(d.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
  }

  function isOffOnDate(r: Role, ds: string): boolean {
    const dow = (new Date(ds + 'T00:00:00').getDay() + 6) % 7
    if (state.dayOff[r].includes(dow)) return true
    return leaveReqs.some(lr => lr.role === r && lr.status === 'approved' && (lr.date === ds || lr.swapDate === ds))
  }

  function isLeaveDate(r: Role, ds: string): boolean {
    return leaveReqs.some(lr => lr.role === r && lr.status === 'approved' && (lr.date === ds || lr.swapDate === ds))
  }

  function toggleDow(r: Role, ds: string) {
    if (!canEdit) return
    const dow = (new Date(ds + 'T00:00:00').getDay() + 6) % 7
    const cur = state.dayOff[r]
    updateState({ dayOff: { ...state.dayOff, [r]: cur.includes(dow) ? cur.filter(d => d !== dow) : [...cur, dow] } })
  }

  function fmtWeekRange(monday: string, sunday: string): string {
    const s = new Date(monday + 'T00:00:00')
    const e = new Date(sunday + 'T00:00:00')
    return `${s.getDate()} ${T.monthShort[s.getMonth()]} – ${e.getDate()} ${T.monthShort[e.getMonth()]} ${e.getFullYear()}`
  }

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>{T.monthlyRoster}</div>
      <div style={{ fontSize: '11px', color: '#9CA3AF', marginBottom: '10px' }}>{T.rosterNote(canEdit)}</div>

      {/* Scrollable weeks */}
      <div ref={scrollRef} style={{ height: '68vh', overflowY: 'auto', borderRadius: '8px', border: '1px solid #E5E7EB' }}>
        {weeks.map(monday => {
          const dates        = weekDates(monday)
          const isCurrent    = monday === currentMonday
          const weekLabel    = fmtWeekRange(monday, dates[6])

          return (
            <div key={monday} ref={isCurrent ? currentRef : undefined}
              style={{ borderBottom: '2px solid #E5E7EB' }}>

              {/* Week label row */}
              <div style={{
                padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '8px',
                background: isCurrent ? '#E8F5E9' : '#F9FAFB',
                borderBottom: '1px solid #E5E7EB',
              }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: isCurrent ? NAV_GREEN : '#6B7280' }}>
                  {weekLabel}
                </span>
                {isCurrent && (
                  <span style={{ ...S.pill, background: NAV_GREEN, color: '#fff', fontSize: '9px', padding: '1px 6px' }}>
                    {T.today}
                  </span>
                )}
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '460px' }}>
                  <thead>
                    <tr style={{ background: '#1B4332' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left', color: '#fff', fontSize: '11px', fontWeight: 700, minWidth: '110px' }}>
                        Person / Role
                      </th>
                      {T.dayShort.map((d, di) => {
                        const isToday = dates[di] === today
                        return (
                          <th key={di} style={{ padding: '6px 4px', textAlign: 'center', color: isToday ? '#c8e84a' : '#a7c28a', fontSize: '11px', fontWeight: 700, width: '52px' }}>
                            {d}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {ROLES.map((r, ri) => {
                      const c = ROLE_COLORS[r]
                      return (
                        <tr key={r} style={{ background: c.bg + '55', borderTop: ri > 0 ? '1px solid rgba(255,255,255,0.7)' : 'none' }}>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: c.dark }}>{ROLE_NAMES[r]}</span>
                            <span style={{ fontSize: '10px', color: '#9CA3AF', marginLeft: '4px' }}>· {ROLE_DEPT[r]}</span>
                          </td>
                          {dates.map((ds, di) => {
                            const off    = isOffOnDate(r, ds)
                            const isLv   = isLeaveDate(r, ds)
                            const isTd   = ds === today
                            return (
                              <td key={di}
                                onClick={() => toggleDow(r, ds)}
                                style={{
                                  padding: '5px 4px', textAlign: 'center',
                                  borderLeft: '1px solid rgba(255,255,255,0.6)',
                                  background: off ? '#FEE2E2' : isTd ? c.bg + 'cc' : c.bg + '88',
                                  cursor: canEdit ? 'pointer' : 'default',
                                  outline: isTd ? `2px solid ${NAV_GREEN}` : 'none',
                                  outlineOffset: '-2px',
                                }}>
                                <span style={{
                                  fontSize: '11px', fontWeight: 700,
                                  color: off ? '#991B1B' : c.dark,
                                  padding: isLv ? '1px 4px' : undefined,
                                  border: isLv ? `1.5px dashed ${c.dark}` : 'none',
                                  borderRadius: '3px',
                                }}>
                                  {off ? 'OFF' : 'ON'}
                                </span>
                              </td>
                            )
                          })}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Leave Request Card ───────────────────────────────────────────────────────

function LeaveRequestCard({ role, T }: { role: Role; T: TXType }) {
  const [rulesOK, setRulesOK]     = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [leaveType, setLeaveType] = useState<LeaveRequest['type']>('leave')
  const [date, setDate]           = useState('')
  const [swapDate, setSwapDate]   = useState('')
  const [reason, setReason]       = useState('')
  const [proofPath, setProofPath] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted]   = useState(false)
  const [myRequests, setMyRequests] = useState<LeaveRequest[]>([])
  const proofRef = useRef<HTMLInputElement>(null)

  function loadMine() {
    setMyRequests(readLeaveRequests().filter(r => r.role === role))
  }
  useEffect(() => { loadMine() }, [role])

  const thisYear = new Date().getFullYear().toString()
  const emergencyUsed = myRequests.filter(r => r.type === 'emergency' && r.status === 'approved' && r.submittedAt.startsWith(thisYear)).length

  function diffFromToday(d: string): number {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return Math.floor((new Date(d + 'T00:00:00').getTime() - today.getTime()) / 86400000)
  }

  function validationMsg(): string {
    if (!date) return ''
    const diff = diffFromToday(date)
    if (leaveType === 'day-off-change' && diff < 30) return T.validDayOff(30 - diff)
    if (leaveType === 'leave'          && diff < 7)  return T.validLeave(7 - diff)
    if (leaveType === 'emergency' && emergencyUsed >= 3) return T.validEmergency
    return ''
  }

  function canSubmit(): boolean {
    if (!date || !reason.trim()) return false
    const diff = diffFromToday(date)
    if (leaveType === 'day-off-change' && diff < 30) return false
    if (leaveType === 'leave'          && diff < 7)  return false
    if (leaveType === 'emergency' && emergencyUsed >= 3) return false
    return true
  }

  async function uploadProof(file: File) {
    const supabase = createClient()
    const path     = `leave-proof/${role}_${Date.now()}_${file.name}`
    const { error } = await supabase.storage.from('booking-docs').upload(path, file, { upsert: true })
    if (!error) setProofPath(path)
  }

  function submitRequest() {
    setSubmitting(true)
    const req: LeaveRequest = {
      id: `lr_${Date.now()}`,
      role, type: leaveType, date,
      swapDate: leaveType === 'day-off-change' ? swapDate : undefined,
      reason: reason.trim(),
      proofPath: proofPath || undefined,
      submittedAt: new Date().toISOString(),
      status: 'pending',
    }
    const existing = readLeaveRequests()
    writeLeaveRequests([...existing, req])
    setDate(''); setReason(''); setSwapDate(''); setProofPath('')
    setSubmitted(true)
    setSubmitting(false)
    loadMine()
    setTimeout(() => setSubmitted(false), 3000)
  }

  const valMsg = validationMsg()
  const typeLabel = (t: LeaveRequest['type']) => t === 'day-off-change' ? T.typeDayOff : t === 'leave' ? T.typeLeave : T.typeEmergency
  const statusLabel = (s: string) => s === 'approved' ? T.sApproved : s === 'rejected' ? T.sRejected : T.sPending
  const statusColor = (s: string) => s === 'approved' ? '#166534' : s === 'rejected' ? '#991B1B' : '#92400E'
  const statusBg    = (s: string) => s === 'approved' ? '#F0FDF4' : s === 'rejected' ? '#FEF2F2' : '#FFFBEB'

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '14px' }}>{T.requestLeave}</div>

      {/* Rules — shown until acknowledged */}
      {!rulesOK && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '10px', padding: '14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E', marginBottom: '10px' }}>{T.rulesBefore}</div>
          <ul style={{ margin: '0 0 10px', paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {T.rules.map((rule, i) => (
              <li key={i} style={{ fontSize: '12px', color: '#78350F', lineHeight: 1.55 }}>{rule}</li>
            ))}
          </ul>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E', marginBottom: '12px' }}>
            {T.emergencyUsed(emergencyUsed)}
          </div>
          <button onClick={() => { setRulesOK(true); setShowRules(false) }}
            style={{ ...S.btn, background: '#D97706', color: '#fff', fontSize: '13px', width: '100%', padding: '11px' }}>
            {T.iUnderstand}
          </button>
        </div>
      )}

      {rulesOK && (
        <>
          {/* Collapsible rules reminder */}
          <button onClick={() => setShowRules(v => !v)}
            style={{ ...S.btn, background: '#FFFBEB', color: '#92400E', fontSize: '11px', padding: '5px 10px', marginBottom: '12px' }}>
            📋 {showRules ? '▲' : '▼'} Rules
          </button>
          {showRules && (
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px' }}>
              {T.rules.map((r, i) => <div key={i} style={{ fontSize: '11px', color: '#78350F', marginBottom: '3px' }}>• {r}</div>)}
              <div style={{ fontSize: '11px', color: '#92400E', fontWeight: 700, marginTop: '6px' }}>{T.emergencyUsed(emergencyUsed)}</div>
            </div>
          )}

          {/* Type selector */}
          <div style={{ marginBottom: '12px' }}>
            <label style={S.label}>{T.leaveType}</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {(['day-off-change', 'leave', 'emergency'] as const).map(lt => {
                const active = leaveType === lt
                return (
                  <button key={lt} onClick={() => setLeaveType(lt)}
                    style={{ ...S.btn, fontSize: '12px', padding: '8px 12px', minHeight: '44px', background: active ? NAV_GREEN : '#F3F4F6', color: active ? '#fff' : '#374151', border: `1px solid ${active ? NAV_GREEN : '#E5E7EB'}` }}>
                    {typeLabel(lt)}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date */}
          <div style={{ marginBottom: '12px' }}>
            <label style={S.label}>{T.leaveDate}</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} min={todayStr()} style={S.input} />
          </div>

          {leaveType === 'day-off-change' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={S.label}>{T.swapDate}</label>
              <input type="date" value={swapDate} onChange={e => setSwapDate(e.target.value)} min={todayStr()} style={S.input} />
            </div>
          )}

          {/* Reason */}
          <div style={{ marginBottom: '12px' }}>
            <label style={S.label}>{T.reason}</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              style={{ ...S.input, resize: 'vertical', fontFamily: '"DM Sans", sans-serif', fontSize: '14px' }} />
          </div>

          {/* Emergency proof */}
          {leaveType === 'emergency' && (
            <div style={{ marginBottom: '12px' }}>
              <label style={S.label}>{T.proofDoc}</label>
              <button onClick={() => proofRef.current?.click()}
                style={{ ...S.btn, background: proofPath ? '#D1FAE5' : '#F3F4F6', color: proofPath ? '#065F46' : '#374151', fontSize: '13px', padding: '9px 14px', minHeight: '44px' }}>
                {proofPath ? T.fileUploaded : T.uploadFile}
              </button>
              <input ref={proofRef} type="file" accept="image/*,application/pdf" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadProof(f); e.target.value = '' }} />
            </div>
          )}

          {valMsg && (
            <div style={{ fontSize: '12px', color: '#DC2626', background: '#FEF2F2', padding: '8px 12px', borderRadius: '8px', marginBottom: '10px' }}>{valMsg}</div>
          )}
          {submitted && (
            <div style={{ fontSize: '13px', color: '#166534', background: '#F0FDF4', padding: '10px 12px', borderRadius: '8px', marginBottom: '10px' }}>{T.submitted}</div>
          )}

          <button onClick={submitRequest} disabled={submitting || !canSubmit()}
            style={{ ...S.btn, background: canSubmit() ? NAV_GREEN : '#D1D5DB', color: '#fff', width: '100%', padding: '13px', fontSize: '14px', opacity: canSubmit() ? 1 : 0.6 }}>
            {submitting ? '…' : T.submit}
          </button>
        </>
      )}

      {/* My requests */}
      {myRequests.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <div style={S.sectionLabel}>{T.myRequests}</div>
          {myRequests.slice().reverse().map(req => (
            <div key={req.id} style={{ background: '#F9FAFB', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px', border: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>{typeLabel(req.type)}</span>
                <span style={{ ...S.pill, background: statusBg(req.status), color: statusColor(req.status), fontSize: '10px' }}>{statusLabel(req.status)}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#6B7280' }}>
                {req.date}{req.swapDate ? ` ↔ ${req.swapDate}` : ''} · {req.reason}
              </div>
              {req.reviewNote && <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px', fontStyle: 'italic' }}>{req.reviewNote}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Pending Requests Card (GM / CEO only) ────────────────────────────────────

function PendingRequestsCard({ T }: { T: TXType }) {
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [note, setNote]           = useState('')

  function load() { setRequests(readLeaveRequests().filter(r => r.status === 'pending')) }
  useEffect(() => { load() }, [])

  function decide(id: string, decision: 'approved' | 'rejected') {
    const all     = readLeaveRequests()
    const updated = all.map(r => r.id === id ? { ...r, status: decision as LeaveRequest['status'], reviewNote: note } : r)
    writeLeaveRequests(updated)
    setReviewing(null); setNote(''); load()
  }

  const typeLabel = (t: LeaveRequest['type']) => t === 'day-off-change' ? T.typeDayOff : t === 'leave' ? T.typeLeave : T.typeEmergency

  return (
    <div style={S.card}>
      <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '12px' }}>
        {T.pendingRequests}{requests.length > 0 ? ` (${requests.length})` : ''}
      </div>
      {requests.length === 0 ? (
        <div style={{ fontSize: '13px', color: '#9CA3AF' }}>{T.noPending}</div>
      ) : (
        requests.map(req => {
          const c = ROLE_COLORS[req.role]
          return (
            <div key={req.id} style={{ background: '#F9FAFB', borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <span style={{ ...S.pill, background: c.bg, color: c.dark }}>{req.role}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{typeLabel(req.type)} · {req.date}{req.swapDate ? ` ↔ ${req.swapDate}` : ''}</div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{req.reason}</div>
                  <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '2px' }}>
                    {new Date(req.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
              {reviewing !== req.id ? (
                <button onClick={() => setReviewing(req.id)}
                  style={{ ...S.btn, fontSize: '12px', padding: '7px 14px', background: NAV_GREEN, color: '#fff', minHeight: '44px' }}>
                  Review
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <input value={note} onChange={e => setNote(e.target.value)} placeholder={T.reviewNotePlaceholder} style={S.input} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => decide(req.id, 'approved')} style={{ ...S.btn, background: '#16A34A', color: '#fff', fontSize: '13px', flex: 1, minHeight: '44px' }}>✓ {T.approve}</button>
                    <button onClick={() => decide(req.id, 'rejected')} style={{ ...S.btn, background: '#DC2626', color: '#fff', fontSize: '13px', flex: 1, minHeight: '44px' }}>✕ {T.reject}</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

function SettingsTab({ role, state, updateState, T }: {
  role: Role; state: AppState; updateState: (p: Partial<AppState>) => void; T: TXType
}) {
  const [newPin, setNewPin]     = useState('')
  const [pinSaved, setPinSaved] = useState(false)
  const canManage = role === 'GM' || role === 'CEO'

  function savePin() {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) return
    updateState({ pins: { ...state.pins, [role]: newPin } })
    setNewPin(''); setPinSaved(true)
    setTimeout(() => setPinSaved(false), 2000)
  }

  return (
    <>
      <MonthlyRosterCard role={role} state={state} updateState={updateState} T={T} />
      {canManage && <PendingRequestsCard T={T} />}
      <LeaveRequestCard role={role} T={T} />
      <div style={S.card}>
        <div style={{ fontWeight: 600, marginBottom: '10px' }}>{T.changePin(role)}</div>
        <label style={S.label}>{T.newPin}</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="password" inputMode="numeric" maxLength={4} value={newPin}
            onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••" style={{ ...S.input, flex: 1, letterSpacing: '0.3em', textAlign: 'center', fontSize: '20px' }} />
          <button onClick={savePin} style={{ ...S.btn, background: NAV_GREEN, color: '#fff', flexShrink: 0 }}>{T.savePIN}</button>
        </div>
        {pinSaved && <div style={{ color: '#166534', fontSize: '13px', marginTop: '8px' }}>{T.pinSaved}</div>}
      </div>
    </>
  )
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({ initialWeekStart, T }: { initialWeekStart: string; T: TXType }) {
  const [weekStart, setWeekStart] = useState(initialWeekStart)
  const [bookings, setBookings]   = useState<Booking[]>([])
  const [loading, setLoading]     = useState(true)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const from = weekStart
    const to   = addDays(weekStart, 6)
    const { data } = await supabase
      .from('bookings')
      .select('id,guest,guest2,room,checkin,checkout,nights,status,passport_url,passport_uploaded_at,guest2_passport_url,guest2_passport_uploaded_at,booking_ref')
      .or(`and(checkin.gte.${from},checkin.lte.${to}),and(checkout.gt.${from},checkout.lte.${to})`)
      .in('status', ['Upcoming', 'Check-in', 'Occupied', 'Checkout'])
      .order('checkin')
    setBookings((data ?? []) as Booking[])
    setLoading(false)
  }, [weekStart])

  useEffect(() => { load() }, [load])

  const checkIns  = weekDates.map(d => bookings.filter(b => b.checkin  === d))
  const checkOuts = weekDates.map(d => bookings.filter(b => b.checkout === d))

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700 }}>{T.himmapunGuests}</div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={() => setWeekStart(addDays(weekStart, -7))}
            style={{ ...S.btn, padding: '6px 14px', fontSize: '18px', background: '#F3F4F6', color: '#374151', minHeight: '44px', lineHeight: 1 }}>‹</button>
          <button onClick={() => setWeekStart(getMondayOf(new Date()))}
            style={{ ...S.btn, padding: '6px 10px', fontSize: '11px', background: '#F3F4F6', color: '#6B7280', minHeight: '44px' }}>{T.today}</button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))}
            style={{ ...S.btn, padding: '6px 14px', fontSize: '18px', background: '#F3F4F6', color: '#374151', minHeight: '44px', lineHeight: 1 }}>›</button>
        </div>
      </div>
      <div style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
        {formatDay(weekDates[0])} – {formatDay(weekDates[6])}
      </div>

      {loading ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#6B7280', padding: '32px' }}>{T.loading}</div>
      ) : bookings.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', color: '#6B7280', padding: '32px' }}>{T.noArrivals}</div>
      ) : (
        weekDates.map((date, i) => {
          const ins  = checkIns[i]
          const outs = checkOuts[i]
          if (ins.length === 0 && outs.length === 0) return null
          return (
            <div key={date}>
              <div style={S.sectionLabel}>{T.dayShort[i]} · {formatDay(date)}</div>
              {ins.map(b  => <BookingCard key={`in-${b.id}`}  booking={b} type="checkin"  onRefresh={load} T={T} />)}
              {outs.map(b => <BookingCard key={`out-${b.id}`} booking={b} type="checkout" onRefresh={load} T={T} />)}
            </div>
          )
        })
      )}
    </>
  )
}

// ─── Booking Card ─────────────────────────────────────────────────────────────

function BookingCard({ booking, type, onRefresh, T }: { booking: Booking; type: 'checkin' | 'checkout'; onRefresh: () => void; T: TXType }) {
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
              {isCheckIn ? T.checkIn : T.checkOut}
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{booking.room}</span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>{booking.guest}</div>
          {booking.guest2 && <div style={{ fontSize: '13px', color: '#6B7280' }}>{booking.guest2}</div>}
          <div style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>
            {booking.checkin} → {booking.checkout} · {T.nights(booking.nights)}
          </div>
        </div>
        <div style={{ fontSize: '18px', color: '#9CA3AF', flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {expanded && (
        <div style={{ borderTop: '1px solid #F3F4F6', padding: '14px 16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={S.label}>{T.secondGuest}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={guest2} onChange={e => setGuest2(e.target.value)} placeholder="Full name" style={{ ...S.input, flex: 1 }} />
              <button onClick={saveGuest2} disabled={saving}
                style={{ ...S.btn, background: NAV_GREEN, color: '#fff', padding: '10px 14px', fontSize: '13px', flexShrink: 0 }}>
                {saving ? '…' : T.save}
              </button>
            </div>
          </div>
          <PassportRow label={`${booking.guest}'s ${T.takeUpload.includes('📷') ? 'Passport' : 'Passport'}`} hasPhoto={!!booking.passport_url}
            uploadedAt={booking.passport_uploaded_at} scanMsg={scanMsg} inputRef={p1Ref}
            onView={() => viewPassport(1)} onFile={f => uploadPassport(f, 1)} T={T} />
          {(booking.guest2 || guest2) && (
            <PassportRow label={`${booking.guest2 || guest2} Passport`} hasPhoto={!!booking.guest2_passport_url}
              uploadedAt={booking.guest2_passport_uploaded_at} scanMsg={scan2Msg} inputRef={p2Ref}
              onView={() => viewPassport(2)} onFile={f => uploadPassport(f, 2)} T={T} />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Passport Row ─────────────────────────────────────────────────────────────

function PassportRow({ label, hasPhoto, uploadedAt, scanMsg, inputRef, onView, onFile, T }: {
  label: string; hasPhoto: boolean; uploadedAt: string | null; scanMsg: string
  inputRef: React.RefObject<HTMLInputElement | null>; onView: () => void; onFile: (f: File) => void; T: TXType
}) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={S.label}>{label}</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => inputRef.current?.click()}
          style={{ ...S.btn, background: '#F3F4F6', color: '#1a1a1a', fontSize: '13px', padding: '9px 14px', minHeight: '44px' }}>
          {hasPhoto ? T.replace : T.takeUpload}
        </button>
        {hasPhoto && (
          <button onClick={onView} style={{ ...S.btn, background: '#EFF6FF', color: '#1E40AF', fontSize: '13px', padding: '9px 14px', minHeight: '44px' }}>
            {T.view}
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
