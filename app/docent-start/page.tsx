'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Shield, AlertTriangle, CheckCircle } from 'lucide-react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export default function DocentStart() {
  const { user, profile, loading, login, logout, register: _r, ...rest } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [claimed, setClaimed] = useState(false)

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
    setClaimed(false)
  }

  // User writes their own Firestore profile as teacher — works without admin credentials
  const claimAsTeacher = async () => {
    if (!user) return
    setClaiming(true)
    try {
      const profileData = {
        uid: user.uid,
        email: user.email || '',
        name: user.displayName || user.email?.split('@')[0] || 'Docent',
        role: 'teacher',
        createdAt: new Date().toISOString(),
      }
      await setDoc(doc(db, 'profiles', user.uid), profileData)
      setClaimed(true)
      // Reload page so AuthContext picks up the new profile
      setTimeout(() => window.location.reload(), 1200)
    } catch (err) {
      setError('Profiel opslaan mislukt. Probeer opnieuw.')
      console.error(err)
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Logged in but not a teacher
  if (user && profile && profile.role !== 'teacher') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-emerald-50 px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4 shadow-md">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">PV Trainer</h1>
            <p className="text-sm text-emerald-700 font-medium mt-1">Docent</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
            {claimed ? (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <p className="text-sm font-medium text-emerald-800">Docentenrol ingesteld — pagina wordt herladen...</p>
              </div>
            ) : (
              <>
                <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Account heeft geen docentenrol</p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      Ingelogd als <strong>{profile.name}</strong>. Klik hieronder om dit account in te stellen als docent.
                    </p>
                  </div>
                </div>
                <button
                  onClick={claimAsTeacher}
                  disabled={claiming}
                  className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {claiming ? 'Bezig...' : 'Stel in als docent'}
                </button>
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                <button
                  onClick={handleLogout}
                  className="w-full border border-gray-200 text-gray-500 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Uitloggen
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4 shadow-md">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PV Trainer</h1>
          <p className="text-sm text-emerald-700 font-medium mt-1">Docent</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Inloggen als docent</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                placeholder="naam@politie.nl"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors mt-2"
            >
              {submitting ? 'Bezig...' : 'Inloggen'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-300 mt-4">
          {process.env.NEXT_PUBLIC_BUILD_TIME
            ? `Versie: ${new Date(process.env.NEXT_PUBLIC_BUILD_TIME).toLocaleString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
            : ''}
        </p>
      </div>
    </div>
  )
}
