import { Status, CleanStatus } from '@/lib/constants'

const STATUS_STYLES: Record<Status, { bg: string; color: string }> = {
  'Upcoming':  { bg: 'rgba(96,165,250,0.15)',  color: 'var(--blue)'  },
  'Check-in':  { bg: 'rgba(74,222,128,0.15)',  color: 'var(--green)' },
  'Occupied':  { bg: 'rgba(96,165,250,0.15)',  color: 'var(--blue)'  },
  'Checkout':  { bg: 'rgba(251,191,36,0.15)',  color: 'var(--amber)' },
  'Completed': { bg: 'rgba(155,143,176,0.15)', color: 'var(--muted)' },
}

const CLEAN_STYLES: Record<CleanStatus, { bg: string; color: string }> = {
  'Clean':          { bg: 'rgba(74,222,128,0.15)',  color: 'var(--green)' },
  'In Progress':    { bg: 'rgba(251,191,36,0.15)',  color: 'var(--amber)' },
  'Needs Cleaning': { bg: 'rgba(248,113,113,0.15)', color: 'var(--red)'   },
}

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status] ?? { bg: 'rgba(155,143,176,0.15)', color: 'var(--muted)' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium"
      style={{ background: s.bg, color: s.color, fontFamily: 'var(--font-dm-mono)' }}
    >
      {status}
    </span>
  )
}

export function CleanBadge({ status }: { status: CleanStatus }) {
  const s = CLEAN_STYLES[status] ?? { bg: 'rgba(155,143,176,0.15)', color: 'var(--muted)' }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium"
      style={{ background: s.bg, color: s.color, fontFamily: 'var(--font-dm-mono)' }}
    >
      {status}
    </span>
  )
}
