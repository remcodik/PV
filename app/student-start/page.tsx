'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { GraduationCap, AlertTriangle } from 'lucide-react'
import { inputClass, labelClass } from '@/app/components/ui/form'
import { Button } from '@/app/components/ui/Button'

export default function StudentStart() {
  const { user, profile, loading, login, logout } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user && profile?.role === 'student') {
      router.replace('/student/dashboard')
    }
  }, [user, profile, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch {
      setError('Ongeldig e-mailadres of wachtwoord.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    setEmail('')
    setPassword('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950">
        <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Logged in but wrong role
  if (user && profile && profile.role !== 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-white/5 border border-white/15 rounded-md mb-4">
              <GraduationCap className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-white tracking-wide">PV Trainer</h1>
            <p className="text-xs text-gold-100/80 uppercase tracking-widest mt-1.5">Student</p>
          </div>
          <div className="bg-white rounded-lg shadow-xl border border-black/5 p-8">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md p-4 mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Geen studentenrol</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Je bent ingelogd als <strong>{profile.name}</strong> met de rol <strong>{profile.role}</strong>.
                  Dit is de studenten-ingang. Gebruik de docenten-ingang of vraag de beheerder om je rol aan te passen.
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleLogout} className="w-full">
              Uitloggen en opnieuw proberen
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Not logged in — show login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/5 border border-white/15 rounded-md mb-4">
            <GraduationCap className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-wide">PV Trainer</h1>
          <p className="text-xs text-gold-100/80 uppercase tracking-widest mt-1.5">Student</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl border border-black/5 p-8">
          <h2 className="text-sm font-semibold text-ink-950 uppercase tracking-wide mb-6">Inloggen als student</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className={inputClass}
                placeholder="naam@politie.nl"
              />
            </div>
            <div>
              <label className={labelClass}>Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className={inputClass}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-md px-3.5 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <Button type="submit" disabled={submitting} className="w-full mt-2">
              {submitting ? 'Bezig...' : 'Inloggen'}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/25 mt-4">
          {process.env.NEXT_PUBLIC_BUILD_TIME
            ? `Versie: ${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </p>
      </div>
    </div>
  )
}
