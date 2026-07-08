'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, AlertCircle } from 'lucide-react'
import { inputClass, labelClass } from '@/app/components/ui/form'
import { Button } from '@/app/components/ui/Button'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [noProfile, setNoProfile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotStatus, setForgotStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const { login, resetPassword } = useAuth()
  const router = useRouter()

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotStatus('sending')
    try {
      await resetPassword(forgotEmail)
      // Always show success, regardless of whether the account exists —
      // this avoids leaking which emails have accounts.
      setForgotStatus('sent')
    } catch {
      setForgotStatus('sent')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setNoProfile(false)
    setLoading(true)
    try {
      await login(email, password)
      router.replace('/')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg === 'NO_PROFILE') {
        setNoProfile(true)
      } else {
        setError('Ongeldig e-mailadres of wachtwoord.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4 py-10">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/5 border border-white/15 rounded-md mb-4">
            <Shield className="w-7 h-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-wide">PV Trainer</h1>
          <p className="text-xs text-white/45 uppercase tracking-widest mt-1.5">Politieopleiding — Proces-verbaal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-xl border border-black/5 p-8">
          <h2 className="text-sm font-semibold text-ink-950 uppercase tracking-wide mb-6">Inloggen</h2>

          {/* No profile error — prominent block */}
          {noProfile && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 mb-5">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-900">Geen account gevonden</p>
                  <p className="text-sm text-amber-800 mt-0.5">
                    Er is geen profiel bij dit e-mailadres. Vraag een beheerder om een account
                    voor je aan te maken — je ontvangt daarna een e-mail om een wachtwoord in
                    te stellen.
                  </p>
                </div>
              </div>
            </div>
          )}

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
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Wachtwoord</label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotStatus('idle') }}
                  className="text-xs text-ink-600 hover:text-ink-800 hover:underline"
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
              <div className="bg-red-50 border border-red-100 rounded-md px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full mt-2">
              {loading ? 'Bezig...' : 'Inloggen'}
            </Button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Geen account? Vraag een beheerder om er een voor je aan te maken.
          </p>
        </div>

        {/* Build version */}
        <p className="text-center text-xs text-white/25 mt-4">
          {process.env.NEXT_PUBLIC_BUILD_TIME
            ? `Versie: ${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString('nl-NL', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}`
            : 'Versie: onbekend'}
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
                  e-mail om een nieuw wachtwoord in te stellen. Geen e-mail werkt (bijv.
                  testaccount)? Vraag een beheerder om de link handmatig te delen.
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
                  <Button type="submit" disabled={forgotStatus === 'sending'} className="flex-1">
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
