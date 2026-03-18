'use client'

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
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">

        {/* Logo / Title */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl mb-1" style={{ fontFamily: 'var(--font-fraunces)', color: 'var(--accent)' }}>
            Himmapun Retreat
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Hotel Operations</p>
        </div>

        {/* Card */}
        <div className="rounded-xl p-6" style={{ background: 'var(--surface)' }}>
          <h2 className="text-lg font-medium mb-6" style={{ color: 'var(--text)' }}>Sign in</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm" style={{ color: 'var(--muted)' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid #2a2c28',
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm" style={{ color: 'var(--muted)' }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid #2a2c28',
                }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg py-2 text-sm font-medium mt-2 transition-opacity disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#0e0f0e' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
