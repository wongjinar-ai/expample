'use client'

import React, { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROOMS, ROOM_TYPES, SOURCES, STATUSES, CLEAN_STATUSES } from '@/lib/constants'
import { calcNights } from '@/lib/helpers'

interface Booking {
  id?: number
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
  // Guest 1 docs
  passport_url?: string
  passport_uploaded_at?: string
  passport_number?: string
  passport_name?: string
  guest_is_thai?: boolean
  // Guest 2 docs
  guest2_passport_url?: string
  guest2_passport_uploaded_at?: string
  guest2_passport_number?: string
  guest2_passport_name?: string
  guest2_is_thai?: boolean
  // TM30 — per guest
  tm30_url?: string
  guest2_tm30?: boolean
  guest2_tm30_url?: string
}

const EMPTY: Booking = {
  invoice_no: '', guest: '', guest2: '', room: ROOMS[0], type: ROOM_TYPES[ROOMS[0]],
  guests: 1, checkin: '', checkout: '', nights: 0,
  source: 'Direct', gross: 0, comm: 0, discount: 0, net_income: 0,
  status: 'Upcoming', clean_status: 'Needs Cleaning',
  special: '', tm30: false, booking_ref: '',
  passport_url: '', passport_number: '', passport_name: '', guest_is_thai: false,
  guest2_passport_url: '', guest2_passport_number: '', guest2_passport_name: '', guest2_is_thai: false,
  guest2_tm30: false, guest2_tm30_url: '',
  tm30_url: '',
}

interface Props {
  booking?: Booking & { id: number }
  onClose: () => void
  onSaved: () => void
}

const BUCKET = 'booking-docs'

async function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const comma = result.indexOf(',')
      resolve({
        data: result.slice(comma + 1),
        mediaType: result.slice(5, comma).replace(';base64', ''),
      })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Re-encode any image (including HEIC) to JPEG via canvas.
// Uses createImageBitmap which natively supports HEIC on macOS Chrome 118+.
async function fileToJpegBase64(file: File): Promise<{ data: string; mediaType: 'image/jpeg' }> {
  const MAX = 1500
  const bitmap = await createImageBitmap(file)
  let { width: w, height: h } = bitmap
  if (w > MAX || h > MAX) {
    if (w > h) { h = Math.round(h * MAX / w); w = MAX }
    else       { w = Math.round(w * MAX / h); h = MAX }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  const comma = dataUrl.indexOf(',')
  return { data: dataUrl.slice(comma + 1), mediaType: 'image/jpeg' }
}

// ── Guest DOC sub-component ───────────────────────────────────────────────────
interface GuestDocProps {
  selectedFile: File | null
  onFileSelect: (f: File) => void
  storedUrl?: string
  onViewFile: (url: string) => void
  isThai: boolean
  onThaiChange: (v: boolean) => void
  passportNumber: string
  onPassportNumberChange: (v: string) => void
  passportName: string
  onPassportNameChange: (v: string) => void
  extracting: boolean
  ocrError?: string
  // TM30 per guest
  tm30Filed: boolean
  onTm30FiledChange: (v: boolean) => void
  tm30File: File | null
  onTm30FileSelect: (f: File) => void
  tm30StoredUrl?: string
  inputStyle: React.CSSProperties
  labelStyle: React.CSSProperties
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  if (!text) return null
  return (
    <button
      type="button"
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="shrink-0 px-2 py-1 rounded-lg text-xs"
      style={{ background: copied ? 'rgba(74,222,128,0.12)' : 'var(--surface)', border: '1px solid #3a2d50', color: copied ? 'var(--green)' : 'var(--muted)' }}
      title="Copy to clipboard"
    >
      {copied ? '✓' : '📋'}
    </button>
  )
}

function GuestDocSection({
  selectedFile, onFileSelect, storedUrl, onViewFile,
  isThai, onThaiChange,
  passportNumber, onPassportNumberChange,
  passportName, onPassportNameChange,
  extracting, ocrError,
  tm30Filed, onTm30FiledChange, tm30File, onTm30FileSelect, tm30StoredUrl,
  inputStyle, labelStyle,
}: GuestDocProps) {
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const prevNumber = useRef('')

  // Auto-open dropdown when OCR fills in passport number
  useEffect(() => {
    if (passportNumber && !prevNumber.current) setOpen(true)
    prevNumber.current = passportNumber
  }, [passportNumber])

  return (
    <div className="mt-1 space-y-2">
      {/* Row: Thai checkbox + DOC + dropdown toggle */}
      <div className="flex items-center gap-2 flex-wrap">
        <label className="flex items-center gap-1.5 cursor-pointer shrink-0" style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
          <input
            type="checkbox"
            checked={isThai}
            onChange={e => onThaiChange(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Thai citizen
        </label>

        {!isThai && (
          <>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs px-2.5 py-1 rounded-lg shrink-0"
              style={{
                background: selectedFile ? 'rgba(74,222,128,0.12)' : 'var(--surface2)',
                color: selectedFile ? 'var(--green)' : 'var(--text)',
                border: `1px solid ${selectedFile ? 'rgba(74,222,128,0.3)' : '#3a2d50'}`,
              }}
            >
              {extracting ? '⏳ Scanning…' : selectedFile ? `✓ ${selectedFile.name.slice(0, 12)}…` : storedUrl ? '📷 Re-upload' : '📷 DOC'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f) }}
            />

            {storedUrl && !selectedFile && (
              <button
                type="button"
                onClick={() => onViewFile(storedUrl)}
                className="text-xs px-2 py-1 rounded-lg shrink-0"
                style={{ background: 'rgba(75,0,165,0.15)', color: 'var(--accent2)', border: '1px solid rgba(75,0,165,0.3)' }}
              >
                View
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="text-xs px-2.5 py-1 rounded-lg shrink-0 ml-auto"
              style={{ background: 'var(--surface2)', color: open ? 'var(--accent2)' : 'var(--muted)', border: '1px solid #3a2d50' }}
            >
              {open ? '▲' : '▼'} Passport
            </button>
          </>
        )}
      </div>

      {/* OCR error */}
      {!isThai && ocrError && (
        <p className="text-xs px-2 py-1 rounded-lg" style={{ color: 'var(--red)', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}>
          ⚠ {ocrError}
        </p>
      )}

      {/* Expanded passport details */}
      {!isThai && open && (
        <div className="rounded-xl p-3 grid gap-2" style={{ background: 'var(--surface2)', border: '1px solid #3a2d50' }}>
          <div>
            <label style={labelStyle}>Passport number</label>
            <div className="flex gap-2 items-center">
              <input
                style={inputStyle}
                value={passportNumber}
                placeholder="e.g. CFL1ZGZ12"
                onChange={e => onPassportNumberChange(e.target.value)}
              />
              <CopyButton text={passportNumber} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Name on passport</label>
            <div className="flex gap-2 items-center">
              <input
                style={inputStyle}
                value={passportName}
                placeholder="As printed on passport"
                onChange={e => onPassportNameChange(e.target.value)}
              />
              <CopyButton text={passportName} />
            </div>
          </div>
        </div>
      )}

      {/* TM30 per guest */}
      {!isThai && (
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <label className="flex items-center gap-1.5 cursor-pointer shrink-0" style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
            <input
              type="checkbox"
              checked={tm30Filed}
              onChange={e => onTm30FiledChange(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            TM30 filed
          </label>
          <label className="text-xs px-2.5 py-1 rounded-lg cursor-pointer shrink-0" style={{ background: tm30File ? 'rgba(74,222,128,0.12)' : 'var(--surface2)', color: tm30File ? 'var(--green)' : 'var(--muted)', border: `1px solid ${tm30File ? 'rgba(74,222,128,0.3)' : '#3a2d50'}` }}>
            {tm30File ? `✓ ${tm30File.name.slice(0, 14)}…` : tm30StoredUrl ? '📄 Replace PDF' : '📄 TM30 PDF'}
            <input type="file" accept="application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onTm30FileSelect(f) }} />
          </label>
          {tm30StoredUrl && !tm30File && (
            <button type="button" onClick={() => onViewFile(tm30StoredUrl)} className="text-xs px-2 py-1 rounded-lg shrink-0" style={{ background: 'rgba(75,0,165,0.15)', color: 'var(--accent2)', border: '1px solid rgba(75,0,165,0.3)' }}>
              View
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main modal ────────────────────────────────────────────────────────────────
export default function BookingModal({ booking, onClose, onSaved }: Props) {
  const [form, setForm] = useState<Booking>(booking ?? EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uploadStatus, setUploadStatus] = useState('')

  // File state
  const [passportFile, setPassportFile] = useState<File | null>(null)
  const [guest2PassportFile, setGuest2PassportFile] = useState<File | null>(null)
  const [tm30File, setTm30File] = useState<File | null>(null)
  const [guest2Tm30File, setGuest2Tm30File] = useState<File | null>(null)

  // Multi-room state (for bookings with >1 unit)
  const [additionalRooms, setAdditionalRooms] = useState<string[]>([])

  // OCR state
  const [passportExtracting, setPassportExtracting] = useState(false)
  const [guest2PassportExtracting, setGuest2PassportExtracting] = useState(false)
  const [passportOcrError, setPassportOcrError] = useState('')
  const [guest2PassportOcrError, setGuest2PassportOcrError] = useState('')
  const [autoFilling, setAutoFilling] = useState(false)
  const [isExtending, setIsExtending] = useState(false)

  // Recalculate nights + net when dates/amounts change
  useEffect(() => {
    if (form.checkin && form.checkout) {
      setForm(f => ({ ...f, nights: calcNights(f.checkin, f.checkout), net_income: f.gross - f.comm - (f.discount ?? 0) }))
    }
  }, [form.checkin, form.checkout, form.gross, form.comm, form.discount])

  function set<K extends keyof Booking>(key: K, value: Booking[K]) {
    setForm(f => {
      const next = { ...f, [key]: value }
      if (key === 'room') next.type = ROOM_TYPES[value as typeof ROOMS[number]] ?? ''
      return next
    })
  }

  // ── OTA screenshot auto-fill ─────────────────────────────────────────────
  async function handleScreenshotAutoFill(file: File) {
    setAutoFilling(true)
    try {
      const { data, mediaType } = await fileToBase64(file)
      const res = await fetch('/api/extract-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, mediaType }),
      })
      const extracted = await res.json()
      setForm(f => ({
        ...f,
        ...(extracted.guest       && { guest: extracted.guest }),
        ...(extracted.checkin     && { checkin: extracted.checkin }),
        ...(extracted.checkout    && { checkout: extracted.checkout }),
        ...(extracted.guests      && { guests: extracted.guests }),
        ...(extracted.source      && { source: extracted.source }),
        ...(extracted.gross       && { gross: extracted.gross }),
        ...(extracted.comm        && { comm: extracted.comm }),
        ...(extracted.booking_ref && { booking_ref: extracted.booking_ref }),
        ...(extracted.special     && { special: extracted.special }),
      }))
      // If multiple units, pre-populate additional room selectors
      if (extracted.units && extracted.units > 1) {
        setAdditionalRooms(Array(extracted.units - 1).fill(''))
      }
    } catch (e) {
      console.error('Auto-fill failed:', e)
    }
    setAutoFilling(false)
  }

  // ── Passport OCR ─────────────────────────────────────────────────────────
  async function handlePassportSelect(file: File, guest: 1 | 2) {
    if (guest === 1) { setPassportFile(file); setPassportExtracting(true); setPassportOcrError('') }
    else { setGuest2PassportFile(file); setGuest2PassportExtracting(true); setGuest2PassportOcrError('') }

    try {
      const { data, mediaType } = await fileToJpegBase64(file)
      const res = await fetch('/api/extract-passport', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: data, mediaType }),
      })
      const extracted = await res.json()
      if (guest === 1) {
        setForm(f => ({
          ...f,
          ...(extracted.name && { passport_name: extracted.name }),
          ...(extracted.passport_number && { passport_number: extracted.passport_number }),
        }))
      } else {
        setForm(f => ({
          ...f,
          ...(extracted.name && { guest2_passport_name: extracted.name }),
          ...(extracted.passport_number && { guest2_passport_number: extracted.passport_number }),
        }))
      }
    } catch (e) {
      console.error('Passport OCR failed:', e)
      const msg = e instanceof Error ? e.message : 'Could not read image. Try a JPEG or PNG.'
      if (guest === 1) setPassportOcrError(msg)
      else setGuest2PassportOcrError(msg)
    }

    if (guest === 1) setPassportExtracting(false)
    else setGuest2PassportExtracting(false)
  }

  // ── File upload helper ───────────────────────────────────────────────────
  async function uploadFile(
    supabase: ReturnType<typeof createClient>,
    bookingId: number,
    file: File,
    pathKey: string,
  ) {
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = `${bookingId}/${pathKey}.${ext}`
    const { error: err } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true })
    if (err) { console.error('Upload error:', err); return null }
    return path
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const supabase = createClient()

    // Multi-room: split gross/comm evenly across all rooms
    const allRooms = [form.room, ...additionalRooms.filter(Boolean)]
    const n = allRooms.length
    const perGross = n > 1 ? parseFloat((form.gross / n).toFixed(2)) : form.gross
    const perComm  = n > 1 ? parseFloat((form.comm  / n).toFixed(2)) : form.comm

    // Edit existing booking (single room only)
    if (booking?.id && !isExtending) {
      const payload = { ...form, nights: calcNights(form.checkin, form.checkout), net_income: form.gross - form.comm - (form.discount ?? 0) }
      delete (payload as { id?: number }).id
      const { error: err } = await supabase.from('bookings').update(payload).eq('id', booking.id)
      if (err) { setError(err.message); setSaving(false); return }

      if (passportFile || guest2PassportFile || tm30File || guest2Tm30File) {
        setUploadStatus('Uploading files…')
        const updates: Partial<Booking> = {}
        if (passportFile) {
          const path = await uploadFile(supabase, booking.id, passportFile, 'passport')
          if (path) { updates.passport_url = path; updates.passport_uploaded_at = new Date().toISOString() }
        }
        if (guest2PassportFile) {
          const path = await uploadFile(supabase, booking.id, guest2PassportFile, 'passport2')
          if (path) { updates.guest2_passport_url = path; updates.guest2_passport_uploaded_at = new Date().toISOString() }
        }
        if (tm30File) {
          const path = await uploadFile(supabase, booking.id, tm30File, 'tm30')
          if (path) updates.tm30_url = path
        }
        if (guest2Tm30File) {
          const path = await uploadFile(supabase, booking.id, guest2Tm30File, 'tm30_guest2')
          if (path) updates.guest2_tm30_url = path
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('bookings').update(updates).eq('id', booking.id)
        }
      }
      onSaved()
      return
    }

    // New booking — create one row per room
    for (let i = 0; i < allRooms.length; i++) {
      const room = allRooms[i]
      const gross = perGross
      const comm  = perComm
      const payload = {
        ...form,
        room,
        type: ROOM_TYPES[room as keyof typeof ROOM_TYPES] ?? form.type,
        gross,
        comm,
        net_income: gross - comm - (form.discount ?? 0),
        nights: calcNights(form.checkin, form.checkout),
      }
      delete (payload as { id?: number }).id

      const { data, error: err } = await supabase.from('bookings').insert(payload).select('id').single()
      if (err) { setError(err.message); setSaving(false); return }
      const bookingId = data.id

      // Only upload docs for the first room
      if (i === 0 && (passportFile || guest2PassportFile || tm30File || guest2Tm30File)) {
        setUploadStatus('Uploading files…')
        const updates: Partial<Booking> = {}
        if (passportFile) {
          const path = await uploadFile(supabase, bookingId, passportFile, 'passport')
          if (path) { updates.passport_url = path; updates.passport_uploaded_at = new Date().toISOString() }
        }
        if (guest2PassportFile) {
          const path = await uploadFile(supabase, bookingId, guest2PassportFile, 'passport2')
          if (path) { updates.guest2_passport_url = path; updates.guest2_passport_uploaded_at = new Date().toISOString() }
        }
        if (tm30File) {
          const path = await uploadFile(supabase, bookingId, tm30File, 'tm30')
          if (path) updates.tm30_url = path
        }
        if (guest2Tm30File) {
          const path = await uploadFile(supabase, bookingId, guest2Tm30File, 'tm30_guest2')
          if (path) updates.guest2_tm30_url = path
        }
        if (Object.keys(updates).length > 0) {
          await supabase.from('bookings').update(updates).eq('id', bookingId)
        }
      }
    }

    onSaved()
  }

  // ── Extend ───────────────────────────────────────────────────────────────
  function handleExtend() {
    setForm(f => ({
      ...f,
      invoice_no: '',
      checkin: '',
      checkout: '',
      nights: 0,
      gross: 0,
      comm: 0,
      discount: 0,
      net_income: 0,
      tm30: false,
      guest2_tm30: false,
      tm30_url: '',
      guest2_tm30_url: '',
      status: 'Upcoming',
    }))
    setIsExtending(true)
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!booking?.id) return
    if (!confirm('Delete this booking?')) return
    const supabase = createClient()
    const toRemove = [booking.passport_url, booking.tm30_url, booking.guest2_passport_url, booking.guest2_tm30_url].filter(Boolean) as string[]
    if (toRemove.length > 0) await supabase.storage.from(BUCKET).remove(toRemove)
    await supabase.from('bookings').delete().eq('id', booking.id)
    onSaved()
  }

  async function openFile(path: string) {
    const supabase = createClient()
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--surface2)', color: 'var(--text)',
    border: '1px solid #3a2d50', borderRadius: '0.75rem',
    padding: '0.5rem 0.75rem', width: '100%', fontSize: '0.875rem',
    fontFamily: 'var(--font-dm-sans)',
  }
  const labelStyle: React.CSSProperties = {
    color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block',
  }
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
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          <h2 id="modal-title" className="text-lg shrink-0" style={{ fontFamily: 'var(--font-dm-mono)', color: 'var(--text)' }}>
            {isExtending ? 'Extend Booking' : booking?.id ? 'Edit Booking' : 'New Booking'}
          </h2>
          <div style={{ flex: 1 }}>
            <input
              placeholder="Invoice No"
              style={{ ...{
                background: 'var(--surface2)', color: 'var(--text)',
                border: '1px solid #3a2d50', borderRadius: '0.75rem',
                padding: '0.35rem 0.75rem', width: '100%', fontSize: '0.8rem',
                fontFamily: 'var(--font-dm-sans)',
              } }}
              value={form.invoice_no ?? ''}
              onChange={e => set('invoice_no', e.target.value)}
            />
          </div>
          {/* Compact OTA auto-fill */}
          <div className="flex items-center gap-2 rounded-lg px-2 py-1 shrink-0"
            style={{ background: 'var(--surface2)', border: '1px solid #3a2d50' }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>
              {autoFilling ? '⏳ Reading…' : '📸 OTA'}
            </span>
            {!autoFilling && (
              <label className="text-xs px-2 py-0.5 rounded cursor-pointer"
                style={{ background: 'var(--surface)', border: '1px solid #3a2d50', color: 'var(--text)', fontSize: '0.7rem' }}>
                Choose image
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleScreenshotAutoFill(f) }} />
              </label>
            )}
          </div>
          <button onClick={onClose} style={{ color: 'var(--muted)', fontSize: '1.25rem', lineHeight: 1, flexShrink: 0 }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">

          {/* ── Guest names ── */}
          {field('bm-guest', 'Guest name *',
            <input id="bm-guest" style={inputStyle} value={form.guest} onChange={e => set('guest', e.target.value)} required />
          )}
          {field('bm-guest2', 'Guest 2',
            <input id="bm-guest2" style={inputStyle} value={form.guest2} onChange={e => set('guest2', e.target.value)} />
          )}

          {/* ── Guest 1 DOC ── */}
          <GuestDocSection
            isThai={!!form.guest_is_thai}
            onThaiChange={v => set('guest_is_thai', v)}
            selectedFile={passportFile}
            onFileSelect={f => handlePassportSelect(f, 1)}
            storedUrl={form.passport_url || undefined}
            onViewFile={openFile}
            passportNumber={form.passport_number ?? ''}
            onPassportNumberChange={v => set('passport_number', v)}
            passportName={form.passport_name ?? ''}
            onPassportNameChange={v => set('passport_name', v)}
            extracting={passportExtracting}
            ocrError={passportOcrError}
            tm30Filed={!!form.tm30}
            onTm30FiledChange={v => set('tm30', v)}
            tm30File={tm30File}
            onTm30FileSelect={f => setTm30File(f)}
            tm30StoredUrl={form.tm30_url || undefined}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />

          {/* ── Guest 2 DOC ── */}
          <GuestDocSection
            isThai={!!form.guest2_is_thai}
            onThaiChange={v => set('guest2_is_thai', v)}
            selectedFile={guest2PassportFile}
            onFileSelect={f => handlePassportSelect(f, 2)}
            storedUrl={form.guest2_passport_url || undefined}
            onViewFile={openFile}
            passportNumber={form.guest2_passport_number ?? ''}
            onPassportNumberChange={v => set('guest2_passport_number', v)}
            passportName={form.guest2_passport_name ?? ''}
            onPassportNameChange={v => set('guest2_passport_name', v)}
            extracting={guest2PassportExtracting}
            ocrError={guest2PassportOcrError}
            tm30Filed={!!form.guest2_tm30}
            onTm30FiledChange={v => set('guest2_tm30', v)}
            tm30File={guest2Tm30File}
            onTm30FileSelect={f => setGuest2Tm30File(f)}
            tm30StoredUrl={form.guest2_tm30_url || undefined}
            inputStyle={inputStyle}
            labelStyle={labelStyle}
          />

          {/* ── Room & Type ── */}
          {field('bm-room', `Room 1 *`,
            <select id="bm-room" style={inputStyle} value={form.room} onChange={e => set('room', e.target.value)} required>
              {ROOMS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}
          {field('bm-type', 'Type',
            <input id="bm-type" style={{ ...inputStyle, opacity: 0.6 }} value={form.type} readOnly />
          )}

          {/* ── Additional rooms (multi-unit bookings) ── */}
          {additionalRooms.map((r, i) => (
            <React.Fragment key={i}>
              {field(`bm-room-${i + 2}`, `Room ${i + 2} *`,
                <div className="flex gap-2">
                  <select
                    id={`bm-room-${i + 2}`}
                    style={inputStyle}
                    value={r}
                    onChange={e => { const next = [...additionalRooms]; next[i] = e.target.value; setAdditionalRooms(next) }}
                    required
                  >
                    <option value="">Select room…</option>
                    {ROOMS.map(room => <option key={room} value={room}>{room}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setAdditionalRooms(additionalRooms.filter((_, j) => j !== i))}
                    style={{ background: 'rgba(248,113,113,0.12)', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: '0.75rem', padding: '0 0.75rem', flexShrink: 0 }}
                  >×</button>
                </div>
              )}
              {field('', 'Type',
                <input style={{ ...inputStyle, opacity: 0.6 }} value={r ? (ROOM_TYPES[r as keyof typeof ROOM_TYPES] ?? '') : ''} readOnly />
              )}
            </React.Fragment>
          ))}

          {/* Add room button — only for new bookings */}
          {!booking?.id && (
            <div className="col-span-2">
              <button
                type="button"
                onClick={() => setAdditionalRooms([...additionalRooms, ''])}
                className="text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'var(--surface2)', color: 'var(--muted)', border: '1px solid #3a2d50' }}
              >
                + Add another room
              </button>
              {additionalRooms.length > 0 && (
                <span className="text-xs ml-3" style={{ color: 'var(--muted)' }}>
                  Gross &amp; commission will be split equally across {additionalRooms.length + 1} rooms
                </span>
              )}
            </div>
          )}

          {/* ── Dates ── */}
          {field('bm-checkin', 'Check-in *',
            <input id="bm-checkin" type="date" style={inputStyle} value={form.checkin} onChange={e => set('checkin', e.target.value)} required />
          )}
          {field('bm-checkout', 'Check-out *',
            <input id="bm-checkout" type="date" style={inputStyle} value={form.checkout} onChange={e => set('checkout', e.target.value)} required />
          )}

          {/* ── Nights & Guests ── */}
          {field('bm-nights', 'Nights',
            <input id="bm-nights" style={{ ...inputStyle, opacity: 0.6 }} value={form.nights} readOnly />
          )}
          {field('bm-guests', 'Guests',
            <input id="bm-guests" type="number" min={1} max={6} style={inputStyle} value={form.guests} onChange={e => set('guests', parseInt(e.target.value))} />
          )}

          {/* ── Source & Status ── */}
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

          {/* ── Financials ── */}
          {field('bm-gross', 'Gross (฿) *',
            <input id="bm-gross" type="number" min={0} step="0.01" style={inputStyle} value={form.gross} onChange={e => set('gross', parseFloat(e.target.value) || 0)} required />
          )}
          {field('bm-comm', 'Commission (฿)',
            <input id="bm-comm" type="number" min={0} step="0.01" style={inputStyle} value={form.comm} onChange={e => set('comm', parseFloat(e.target.value) || 0)} />
          )}
          {field('bm-discount', 'Discount (฿)',
            <input id="bm-discount" type="number" min={0} step="0.01" style={inputStyle} value={form.discount ?? 0} onChange={e => set('discount', parseFloat(e.target.value) || 0)} />
          )}
          {field('bm-net', 'Net Income (฿)',
            <input id="bm-net" style={{ ...inputStyle, opacity: 0.6 }} value={form.gross - form.comm - (form.discount ?? 0)} readOnly />
          )}

          {/* ── Clean status + Booking Ref ── */}
          {field('bm-clean', 'Clean Status',
            <select id="bm-clean" style={inputStyle} value={form.clean_status} onChange={e => set('clean_status', e.target.value)}>
              {CLEAN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          {field('bm-ref', 'Booking Ref',
            <input id="bm-ref" style={inputStyle} value={form.booking_ref} onChange={e => set('booking_ref', e.target.value)} />
          )}

          {/* ── Special notes ── */}
          <div className="col-span-2">
            <label htmlFor="bm-special" style={labelStyle}>Special notes</label>
            <textarea id="bm-special" rows={2} style={{ ...inputStyle, resize: 'vertical' }} value={form.special} onChange={e => set('special', e.target.value)} />
          </div>

          {error &&<p className="col-span-2 text-sm" style={{ color: 'var(--red)' }}>{error}</p>}
          {uploadStatus && <p className="col-span-2 text-xs" style={{ color: 'var(--muted)' }}>{uploadStatus}</p>}

          {/* ── Actions ── */}
          <div className="col-span-2 flex items-center justify-between gap-3 pt-2">
            {booking?.id && !isExtending ? (
              <button type="button" onClick={handleDelete} className="px-4 py-2 rounded-xl text-sm" style={{ background: 'rgba(248,113,113,0.15)', color: 'var(--red)' }}>
                Delete
              </button>
            ) : <div />}
            <div className="flex gap-3 items-center">
              {booking?.id && !isExtending && (
                <button type="button" onClick={handleExtend} className="px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(75,0,165,0.15)', color: 'var(--accent2)', border: '1px solid rgba(75,0,165,0.3)' }}>
                  Extend
                </button>
              )}
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-sm" style={{ background: 'var(--surface2)', color: 'var(--muted)' }}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                style={{ background: '#111', color: '#fff' }}>
                {saving ? (uploadStatus || 'Saving…') : (isExtending ? 'Add Extension' : booking?.id ? 'Save Changes' : 'Add Booking')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
