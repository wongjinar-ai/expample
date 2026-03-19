'use client'

import Image from 'next/image'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    fontSize: '13px',
    padding: '8px 12px',
    borderRadius: '6px',
    border: '0.5px solid var(--border2)',
    background: 'var(--bg)',
    color: 'var(--text)',
    outline: 'none',
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'var(--surface)' }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* Logo */}
        <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
          <div style={{ display: 'inline-block', borderRadius: '12px', overflow: 'hidden', width: '120px', marginBottom: '12px' }}>
            <Image
              src="/himmapun-logo.png"
              alt="Himmapun Retreat"
              width={120}
              height={120}
              priority
            />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Simple Natural Living
          </p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg)', border: '0.5px solid var(--border2)', borderRadius: '8px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text)', marginBottom: '20px' }}>Sign in</h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label htmlFor="email" style={{ fontSize: '12px', color: 'var(--muted)' }}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label htmlFor="password" style={{ fontSize: '12px', color: 'var(--muted)' }}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>

            {error && (
              <p style={{ fontSize: '12px', color: 'var(--red)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                fontSize: '13px',
                padding: '9px',
                borderRadius: '6px',
                border: 'none',
                background: 'var(--text)',
                color: 'var(--bg)',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                marginTop: '4px',
              }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--muted)' }}>
          Doi Saket, Chiang Mai
        </p>
      </div>
    </div>
  )
}
