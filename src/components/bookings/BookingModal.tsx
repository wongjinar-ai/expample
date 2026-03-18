'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROOMS, ROOM_TYPES, SOURCES, STATUSES, CLEAN_STATUSES } from '@/lib/constants'
import { calcNights } from '@/lib/helpers'

interface Booking {
  id?: number
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
}

const EMPTY: Booking = {
  guest: '', guest2: '', room: ROOMS[0], type: ROOM_TYPES[ROOMS[0]],
  guests: 1, checkin: '', checkout: '', nights: 0,
  source: 'Direct', gross: 0, comm: 0, net_income: 0,
  status: 'Upcoming', clean_status: 'Needs Cleaning',
  special: '', tm30: false, booking_ref: '',
}

interface Props {
  booking?: Booking & { id: number }
  onClose: () => void
  onSaved: () => void
}

export default function BookingModal({ booking, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Booking>(booking ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (form.checkin && form.checkout) {
      const nights = calcNights(form.checkin, form.checkout)
      const net_income = form.gross - form.comm
      setForm(f => ({ ...f, nights, net_income }))
    }
  }, [form.checkin, form.checkout, form.gross, form.comm])

  function set<K extends keyof Booking>(key: K, value: Booking[K]) {
    setForm(f => {
      const next = { ...f, [key]: value }
      if (key === 'room') next.type = ROOM_TYPES[value as typeof ROOMS[number]] ?? ''
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = { ...form, nights: calcNights(form.checkin, form.checkout), net_income: form.gross - form.comm }
    delete (payload as { id?: number }).id

    const { error: err } = booking?.id
      ? await supabase.from('bookings').update(payload).eq('id', booking.id)
      : await supabase.from('bookings').insert(payload)

    if (err) { setError(err.message); setSaving(false) }
    else { onSaved() }
  }

  async function handleDelete() {
    if (!booking?.id) return
    if (!confirm('Delete this booking?')) return
    const supabase = createClient()
    await supabase.from('bookings').delete().eq('id', booking.id)
    onSaved()
  }

  const inputStyle = {
    background: 'var(--surface2)', color: 'var(--text)',
    border: '1px solid #3a2d50', borderRadius: '0.75rem',
    padding: '0.5rem 0.75rem', width: '100%', fontSize: '0.875rem',
    fontFamily: 'var(--font-dm-sans)',
  }
  const labelStyle = { color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }

  const field = (id: string, label: string, el: React.ReactNode) => (
    <div>
      <label htmlFor={id} style={labelStyle}>{label}</label>
      {el}
    </div>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
        style={{ background: 'var(--surface)', border: '1px solid #2e2040' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="modal-title" className="text-lg" style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }}>
            {booking?.id ? 'Edit Booking' : 'New Booking'}
          </h2>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: '1.25rem', lineHeight: 1 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          {/* Guest */}
          {field('bm-guest', 'Guest name *',
            <input id="bm-guest" style={inputStyle} value={form.guest} onChange={e => set('guest', e.target.value)} required />
          )}
          {field('bm-guest2', 'Guest 2',
            <input id="bm-guest2" style={inputStyle} value={form.guest2} onChange={e => set('guest2', e.target.value)} />
          )}

          {/* Room */}
          {field('bm-room', 'Room *',
            <select id="bm-room" style={inputStyle} value={form.room} onChange={e => set('room', e.target.value)} required>
              {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {field('bm-type', 'Type',
            <input id="bm-type" style={{ ...inputStyle, opacity: 0.6 }} value={form.type} readOnly />
          )}

          {/* Dates */}
          {field('bm-checkin', 'Check-in *',
            <input id="bm-checkin" type="date" style={inputStyle} value={form.checkin} onChange={e => set('checkin', e.target.value)} required />
          )}
          {field('bm-checkout', 'Check-out *',
            <input id="bm-checkout" type="date" style={inputStyle} value={form.checkout} onChange={e => set('checkout', e.target.value)} required />
          )}

          {/* Nights & Guests */}
          {field('bm-nights', 'Nights',
            <input id="bm-nights" style={{ ...inputStyle, opacity: 0.6 }} value={form.nights} readOnly />
          )}
          {field('bm-guests', 'Guests',
            <input id="bm-guests" type="number" min={1} max={6} style={inputStyle} value={form.guests} onChange={e => set('guests', parseInt(e.target.value))} />
          )}

          {/* Source & Status */}
          {field('bm-source', 'Source *',
            <select id="bm-source" style={inputStyle} value={form.source} onChange={e => set('source', e.target.value)}>
              {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {field('bm-status', 'Status',
            <select id="bm-status" style={inputStyle} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* Financials */}
          {field('bm-gross', 'Gross (฿) *',
            <input id="bm-gross" type="number" min={0} style={inputStyle} value={form.gross} onChange={e => set('gross', parseInt(e.target.value) || 0)} required />
          )}
          {field('bm-comm', 'Commission (฿)',
            <input id="bm-comm" type="number" min={0} style={inputStyle} value={form.comm} onChange={e => set('comm', parseInt(e.target.value) || 0)} />
          )}
          {field('bm-net', 'Net Income (฿)',
            <input id="bm-net" style={{ ...inputStyle, opacity: 0.6 }} value={form.gross - form.comm} readOnly />
          )}
          {field('bm-ref', 'Booking Ref',
            <input id="bm-ref" style={inputStyle} value={form.booking_ref} onChange={e => set('booking_ref', e.target.value)} />
          )}

          {/* Clean status */}
          {field('bm-clean', 'Clean Status',
            <select id="bm-clean" style={inputStyle} value={form.clean_status} onChange={e => set('clean_status', e.target.value)}>
              {CLEAN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}

          {/* TM30 */}
          <div className="flex items-center gap-2" style={{ paddingTop: '1.25rem' }}>
            <input
              type="checkbox"
              id="bm-tm30"
              checked={form.tm30}
              onChange={e => set('tm30', e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            <label htmlFor="bm-tm30" style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>TM30 filed</label>
          </div>

          {/* Special notes */}
          <div className="col-span-2">
            <label htmlFor="bm-special" style={labelStyle}>Special notes</label>
            <textarea
              id="bm-special"
              rows={2}
              style={{ ...inputStyle, resize: 'vertical' }}
              value={form.special}
              onChange={e => set('special', e.target.value)}
            />
          </div>

          {error && <p className="col-span-2 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}

          {/* Actions */}
          <div className="col-span-2 flex items-center justify-between gap-3 pt-2">
            {booking?.id ? (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--red)' }}
              >
                Delete
              </button>
            ) : <div />}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: 'var(--surface2)', color: 'var(--muted)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {saving ? 'Saving…' : booking?.id ? 'Save Changes' : 'Add Booking'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
