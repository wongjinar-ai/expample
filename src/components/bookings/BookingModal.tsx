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
  passport_url?: string
  tm30_url?: string
  passport_uploaded_at?: string
}

const EMPTY: Booking = {
  guest: '', guest2: '', room: ROOMS[0], type: ROOM_TYPES[ROOMS[0]],
  guests: 1, checkin: '', checkout: '', nights: 0,
  source: 'Direct', gross: 0, comm: 0, net_income: 0,
  status: 'Upcoming', clean_status: 'Needs Cleaning',
  special: '', tm30: false, booking_ref: '',
  passport_url: '', tm30_url: '',
}

interface Props {
  booking?: Booking & { id: number }
  onClose: () => void
  onSaved: () => void
}

const BUCKET = 'booking-docs'

export default function BookingModal({ booking, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Booking>(booking ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [passportFile, setPassportFile] = useState<File | null>(null)
  const [tm30File, setTm30File] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState('')

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

  async function uploadFile(supabase: ReturnType<typeof createClient>, bookingId: number, file: File, pathKey: 'passport' | 'tm30') {
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${bookingId}/${pathKey}.${ext}`
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { upsert: true })
    if (uploadErr) {
      console.error('Upload error:', uploadErr)
      return null
    }
    return path
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()
    const payload = { ...form, nights: calcNights(form.checkin, form.checkout), net_income: form.gross - form.comm }
    delete (payload as { id?: number }).id

    let bookingId = booking?.id

    if (booking?.id) {
      const { error: err } = await supabase.from('bookings').update(payload).eq('id', booking.id)
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      const { data, error: err } = await supabase.from('bookings').insert(payload).select('id').single()
      if (err) { setError(err.message); setSaving(false); return }
      bookingId = data.id
    }

    // Upload documents
    if ((passportFile || tm30File) && bookingId) {
      setUploadStatus('Uploading files…')
      const updates: Partial<Booking> = {}

      if (passportFile) {
        const path = await uploadFile(supabase, bookingId, passportFile, 'passport')
        if (path) updates.passport_url = path
      }
      if (tm30File) {
        const path = await uploadFile(supabase, bookingId, tm30File, 'tm30')
        if (path) updates.tm30_url = path
      }

      if (passportFile && updates.passport_url) {
        updates.passport_uploaded_at = new Date().toISOString()
      }
      if (Object.keys(updates).length > 0) {
        await supabase.from('bookings').update(updates).eq('id', bookingId)
      }
    }

    onSaved()
  }

  async function handleDelete() {
    if (!booking?.id) return
    if (!confirm('Delete this booking?')) return
    const supabase = createClient()
    // Clean up stored files first
    if (booking.passport_url) await supabase.storage.from(BUCKET).remove([booking.passport_url])
    if (booking.tm30_url) await supabase.storage.from(BUCKET).remove([booking.tm30_url])
    await supabase.from('bookings').delete().eq('id', booking.id)
    onSaved()
  }

  async function openFile(path: string) {
    const supabase = createClient()
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
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

  function FileSlot({
    label,
    accept,
    storedPath,
    selectedFile,
    onSelect,
  }: {
    label: string
    accept: string
    storedPath?: string
    selectedFile: File | null
    onSelect: (f: File | null) => void
  }) {
    return (
      <div className="rounded-xl p-3" style={{ background: 'var(--surface2)', border: '1px solid #3a2d50' }}>
        <p className="text-xs mb-2" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>{label}</p>
        <div className="flex items-center gap-2 flex-wrap">
          {storedPath && (
            <button
              type="button"
              onClick={() => openFile(storedPath)}
              className="text-xs px-2.5 py-1 rounded-lg"
              style={{ background: 'rgba(75,0,165,0.2)', color: 'var(--accent2)', border: '1px solid rgba(75,0,165,0.4)' }}
            >
              View
            </button>
          )}
          <label
            className="text-xs px-2.5 py-1 rounded-lg cursor-pointer"
            style={{ background: 'var(--surface)', border: '1px solid #3a2d50', color: 'var(--text)' }}
          >
            {storedPath ? 'Replace' : 'Upload'}
            <input
              type="file"
              accept={accept}
              className="hidden"
              onChange={e => onSelect(e.target.files?.[0] ?? null)}
            />
          </label>
          {selectedFile && (
            <span className="text-xs truncate max-w-[10rem]" style={{ color: 'var(--green)' }} title={selectedFile.name}>
              ✓ {selectedFile.name}
            </span>
          )}
          {!selectedFile && storedPath && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              {storedPath.split('/').pop()}
            </span>
          )}
          {!selectedFile && !storedPath && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>No file</span>
          )}
        </div>
      </div>
    )
  }

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

          {/* TM30 checkbox */}
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

          {/* Documents */}
          <div className="col-span-2">
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--muted)', fontFamily: 'var(--font-dm-mono)' }}>
              Documents
            </p>
            <div className="grid grid-cols-2 gap-3">
              <FileSlot
                label="Passport / ID photo"
                accept="image/*,application/pdf"
                storedPath={form.passport_url || undefined}
                selectedFile={passportFile}
                onSelect={setPassportFile}
              />
              <FileSlot
                label="TM30 PDF"
                accept="application/pdf"
                storedPath={form.tm30_url || undefined}
                selectedFile={tm30File}
                onSelect={setTm30File}
              />
            </div>
          </div>

          {error && <p className="col-span-2 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          {uploadStatus && <p className="col-span-2 text-xs" style={{ color: 'var(--muted)' }}>{uploadStatus}</p>}

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
                {saving ? (uploadStatus || 'Saving…') : booking?.id ? 'Save Changes' : 'Add Booking'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
