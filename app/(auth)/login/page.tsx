'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, AlertCircle } from 'lucide-react'

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-2xl mb-4 shadow-md">
            <Shield className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">PV Trainer</h1>
          <p className="text-sm text-gray-500 mt-1">Politieopleiding — Proces-verbaal</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Inloggen</h2>

          {/* No profile error — prominent block */}
          {noProfile && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
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
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                E-mailadres
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="naam@politie.nl"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Wachtwoord
                </label>
                <button
                  type="button"
                  onClick={() => { setShowForgot(true); setForgotEmail(email); setForgotStatus('idle') }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Vergeten?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
            >
              {loading ? 'Bezig...' : 'Inloggen'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Geen account? Vraag een beheerder om er een voor je aan te maken.
          </p>
        </div>

        {/* Build version */}
        <p className="text-center text-xs text-gray-300 mt-4">
          {process.env.NEXT_PUBLIC_BUILD_TIME
            ? `Versie: ${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString('nl-NL', {
                day: 'numeric', month: 'long', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}`
            : 'Versie: onbekend'}
        </p>
      </div>

      {showForgot && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            {forgotStatus === 'sent' ? (
              <>
                <h3 className="font-semibold text-gray-900 mb-1">E-mail verstuurd</h3>
                <p className="text-sm text-gray-500 mb-5">
                  Als er een account bestaat bij <strong>{forgotEmail}</strong>, ontvang je een
                  e-mail om een nieuw wachtwoord in te stellen. Geen e-mail werkt (bijv.
                  testaccount)? Vraag een beheerder om de link handmatig te delen.
                </p>
                <button
                  onClick={() => setShowForgot(false)}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Sluiten
                </button>
              </>
            ) : (
              <form onSubmit={handleForgotSubmit}>
                <h3 className="font-semibold text-gray-900 mb-1">Wachtwoord vergeten</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Vul je e-mailadres in — je ontvangt een link om een nieuw wachtwoord in te stellen.
                </p>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="naam@politie.nl"
                  className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgot(false)}
                    className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    Annuleren
                  </button>
                  <button
                    type="submit"
                    disabled={forgotStatus === 'sending'}
                    className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {forgotStatus === 'sending' ? 'Bezig...' : 'Versturen'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
