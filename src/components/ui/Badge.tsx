import { Status, CleanStatus } from '@/lib/constants'

const BADGE_BASE: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '11px',
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: '20px',
}

const STATUS_STYLES: Record<Status, { bg: string; color: string }> = {
  'Upcoming':  { bg: '#EEEDFE', color: '#3C3489' },
  'Check-in':  { bg: '#EAF3DE', color: '#27500A' },
  'Occupied':  { bg: '#E6F1FB', color: '#0C447C' },
  'Checkout':  { bg: '#FAEEDA', color: '#633806' },
  'Completed': { bg: '#F1EFE8', color: '#444441' },
}

const CLEAN_STYLES: Record<CleanStatus, { bg: string; color: string }> = {
  'Clean':          { bg: '#EAF3DE', color: '#27500A' },
  'In Progress':    { bg: '#FAEEDA', color: '#633806' },
  'Needs Cleaning': { bg: '#FCEBEB', color: '#791F1F' },
}

const SOURCE_STYLES: Record<string, { bg: string; color: string }> = {
  'Direct':      { bg: '#EAF3DE', color: '#27500A' },
  'Booking.com': { bg: '#EEEDFE', color: '#3C3489' },
  'Agoda':       { bg: '#EEEDFE', color: '#3C3489' },
  'Airbnb':      { bg: '#EEEDFE', color: '#3C3489' },
  'Other':       { bg: '#F1EFE8', color: '#444441' },
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status] ?? { bg: '#F1EFE8', color: '#444441' }
  return (
    <span style={{ ...BADGE_BASE, background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

export function CleanBadge({ status }: { status: CleanStatus }) {
  const s = CLEAN_STYLES[status] ?? { bg: '#F1EFE8', color: '#444441' }
  return (
    <span style={{ ...BADGE_BASE, background: s.bg, color: s.color }}>
      {status}
    </span>
  )
}

export function SourceBadge({ source }: { source: string }) {
  const s = SOURCE_STYLES[source] ?? { bg: '#F1EFE8', color: '#444441' }
  return (
    <span style={{ ...BADGE_BASE, background: s.bg, color: s.color }}>
      {source}
    </span>
  )
}

export function ShiftBadge({ shift }: { shift: string }) {
  let bg = '#EAF3DE'
  let color = '#27500A'
  if (shift === 'Evening') { bg = '#EEEDFE'; color = '#3C3489' }
  if (shift === 'Night')   { bg = '#E6F1FB'; color = '#0C447C' }
  return (
    <span style={{ ...BADGE_BASE, background: bg, color }}>
      {shift}
    </span>
  )
}
