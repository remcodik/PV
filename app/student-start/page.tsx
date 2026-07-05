'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { GraduationCap, AlertTriangle } from 'lucide-react'

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
      <div className="min-h-screen flex items-center justify-center bg-student-tint">
        <div className="w-6 h-6 border-2 border-student-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Logged in but wrong role
  if (user && profile && profile.role !== 'student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-student-tint px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-student-indigo rounded-2xl mb-4 shadow-md">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">PV Trainer</h1>
            <p className="text-sm text-student-indigo font-medium mt-1">Student</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Geen studentenrol</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Je bent ingelogd als <strong>{profile.name}</strong> met de rol <strong>{profile.role}</strong>.
                  Dit is de studenten-ingang. Gebruik de docenten-ingang of vraag de beheerder om je rol aan te passen.
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full border border-gray-200 text-gray-700 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Uitloggen en opnieuw proberen
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Not logged in — show login form
  return (
    <div className="min-h-screen flex items-center justify-center bg-student-tint px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-student-indigo rounded-2xl mb-4 shadow-md">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">PV Trainer</h1>
          <p className="text-sm text-student-indigo font-medium mt-1">Student</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-base font-semibold text-gray-800 mb-6">Inloggen als student</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-student-indigo/20 focus:border-blue-500 transition-colors"
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
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-student-indigo/20 focus:border-blue-500 transition-colors"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5 text-sm text-red-700">{error}</div>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-student-indigo text-white py-2.5 rounded-lg text-sm font-medium hover:bg-student-indigo-dark disabled:opacity-50 transition-colors mt-2"
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
