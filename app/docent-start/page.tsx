'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, AlertTriangle } from 'lucide-react'
import { inputClass, labelClass } from '@/app/components/ui/form'
import { Button } from '@/app/components/ui/Button'

export default function DocentStart() {
  const { user, profile, loading, login, logout, resetPassword } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'sending' | 'sent'>('idle')

  useEffect(() => {
    if (loading) return
    if (user && profile?.role === 'teacher') {
      router.replace('/teacher/dashboard')
    }
  }, [user, profile, loading, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'NO_PROFILE') {
        setError('Dit account bestaat wel in Firebase Auth, maar heeft geen profiel. Vraag een beheerder om een account voor je aan te maken.')
      } else if (msg === 'PROFILE_FETCH_FAILED') {
        setError('Inloggen is gelukt, maar je profiel kon niet worden opgehaald (serverfout). Probeer het zo opnieuw, of meld dit.')
      } else {
        setError('Ongeldig e-mailadres of wachtwoord.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotStatus('sending')
    try {
      await resetPassword(forgotEmail)
    } catch {
      // Always show success either way — avoids leaking which emails have accounts
    } finally {
      setForgotStatus('sent')
    }
  }

  const handleLogout = async () => {
    await logout()
    setEmail('')
    setPassword('')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-900">
        <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Logged in but not a teacher — there is no self-service way to become
  // one. Only an admin can grant the teacher role (via the users page),
  // which also updates the Firebase Auth custom claim server-side.
  if (user && profile && profile.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-900 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-600 rounded-md mb-4 shadow-lg">
              <Shield className="w-7 h-7 text-ink-950" />
            </div>
            <h1 className="text-xl font-semibold text-white tracking-wide">PV Trainer</h1>
            <p className="text-xs text-gold-100 uppercase tracking-widest mt-1.5">Docent</p>
          </div>
          <div className="bg-white rounded-lg shadow-xl border border-black/5 p-8 space-y-4">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-md p-4">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Account heeft geen docentenrol</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Ingelogd als <strong>{profile.name}</strong>. Vraag een beheerder om je account
                  de docentenrol te geven.
                </p>
              </div>
            </div>
            <Button variant="secondary" onClick={handleLogout} className="w-full">
              Uitloggen
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-900 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-600 rounded-md mb-4 shadow-lg">
            <Shield className="w-7 h-7 text-ink-950" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-wide">PV Trainer</h1>
          <p className="text-xs text-gold-100 uppercase tracking-widest mt-1.5">Docent</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl border border-black/5 p-8">
          <h2 className="text-sm font-semibold text-ink-950 uppercase tracking-wide mb-6">Inloggen als docent</h2>
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
              <div className="flex items-center justify-between mb-1.5">
                <label className={labelClass}>Wachtwoord</label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotStatus('idle') }}
                  className="text-xs text-gold-700 hover:underline"
                >
                  Vergeten?
                </button>
              </div>
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
            <Button type="submit" variant="gold" disabled={submitting} className="w-full mt-2">
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

      {showForgot && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            {forgotStatus === 'sent' ? (
              <>
                <h3 className="font-semibold text-ink-950 mb-1">E-mail verstuurd</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Als er een account bestaat bij <strong>{forgotEmail}</strong>, ontvang je een
                  e-mail om een nieuw wachtwoord in te stellen.
                </p>
                <Button onClick={() => setShowForgot(false)} className="w-full">
                  Sluiten
                </Button>
              </>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <h3 className="font-semibold text-ink-950 mb-1">Wachtwoord vergeten</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Vul je e-mailadres in — je ontvangt een link om een nieuw wachtwoord in te stellen.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="naam@politie.nl"
                  className={`${inputClass} mb-4`}
                />
                <div className="flex gap-3">
                  <Button type="button" variant="secondary" onClick={() => setShowForgot(false)} className="flex-1">
                    Annuleren
                  </Button>
                  <Button type="submit" variant="gold" disabled={forgotStatus === 'sending'} className="flex-1">
                    {forgotStatus === 'sending' ? 'Bezig...' : 'Versturen'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
