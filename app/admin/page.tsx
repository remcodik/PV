'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Lock, AlertTriangle } from 'lucide-react'
import { inputClass, labelClass } from '@/app/components/ui/form'
import { Button } from '@/app/components/ui/Button'

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
      <div className="min-h-screen flex items-center justify-center bg-ink-950">
        <div className="w-6 h-6 border-2 border-white/60 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user && profile && profile.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
        <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-black/5 p-8 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-amber-600 mx-auto" />
          <p className="text-sm text-gray-700">
            Ingelogd als <strong>{profile.name}</strong>, maar dit account heeft geen
            beheerrechten (docentenrol).
          </p>
          <Button variant="secondary" onClick={async () => { await logout() }} className="w-full">
            Uitloggen
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-white/5 border border-white/15 rounded-md mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-wide">Beheer</h1>
          <p className="text-xs text-white/45 uppercase tracking-widest mt-1.5">PV Trainer — accountbeheer</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl border border-black/5 p-8">
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
          Geen toegang? Alleen bestaande docentaccounts kunnen hier inloggen.
        </p>
      </div>
    </div>
  )
}
