'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Lock, AlertTriangle } from 'lucide-react'

// A separate entrance for account administration. There is no distinct
// "admin" role in the data model — this is the same teacher role as
// /teacher/*, just a different door that lands directly on user
// management instead of the teaching dashboard. See README "Account
// model" for why: bootstrapping a genuinely separate role would need its
// own chicken-and-egg solution, and wasn't asked for — just a clearly
// separate entrance was.
export default function AdminEntrance() {
  const { user, profile, loading, login, logout } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user && profile?.role === 'teacher') {
      router.replace('/teacher/users')
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teacher-paper">
        <div className="w-6 h-6 border-2 border-teacher-ink border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user && profile && profile.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-teacher-paper px-4 font-teacher">
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="text-sm text-gray-700">
            Ingelogd als <strong>{profile.name}</strong>, maar dit account heeft geen
            beheerrechten (docentenrol).
          </p>
          <button
            onClick={async () => { await logout() }}
            className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
          >
            Uitloggen
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-teacher-paper px-4 font-teacher">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teacher-ink rounded-lg mb-4 shadow-md">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Beheer</h1>
          <p className="text-sm text-gray-500 mt-1">PV Trainer — accountbeheer</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
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
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teacher-ink/20 focus:border-teacher-ink transition-colors"
                placeholder="naam@politie.nl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                Wachtwoord
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teacher-ink/20 focus:border-teacher-ink transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-teacher-ink text-white py-2.5 rounded-lg text-sm font-medium hover:bg-teacher-ink-dark disabled:opacity-50 transition-colors mt-2"
            >
              {submitting ? 'Bezig...' : 'Inloggen'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Geen toegang? Alleen bestaande docentaccounts kunnen hier inloggen.
        </p>
      </div>
    </div>
  )
}
