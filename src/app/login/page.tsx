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

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ width: '200px', background: 'var(--accent)' }}
          >
            <Image
              src="/himmapun-logo.png"
              alt="Himmapun Retreat"
              width={200}
              height={200}
              priority
            />
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: 'var(--surface)', border: '1px solid #2e2040' }}>
          <h2 className="text-lg font-medium mb-6" style={{ color: 'var(--text)' }}>Sign in</h2>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm" style={{ color: 'var(--muted)' }}>Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2"
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid #3a2d50',
                  // @ts-expect-error css var
                  '--tw-ring-color': 'var(--accent2)',
                }}
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="password" className="text-sm" style={{ color: 'var(--muted)' }}>Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2"
                style={{
                  background: 'var(--surface2)',
                  color: 'var(--text)',
                  border: '1px solid #3a2d50',
                }}
              />
            </div>

            {error && (
              <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-semibold mt-2 transition-opacity disabled:opacity-50 tracking-wide"
              style={{ background: 'var(--accent)', color: '#ffffff' }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center mt-4 text-xs" style={{ color: 'var(--muted)' }}>
          Doi Saket, Chiang Mai
        </p>
      </div>
    </div>
  )
}
