'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, PVReport } from '@/lib/types'
import { formatDate, statusLabel, gradeColor } from '@/lib/utils'
import { Shield, BookOpen, CheckCircle, Plus, LogOut, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import AttentionNoteBanner from '@/app/student/components/AttentionNoteBanner'

export default function StudentDashboard() {
  const { profile, logout } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [reports, setReports] = useState<PVReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const fetchData = async () => {
      try {
        const [sessSnap, repSnap] = await Promise.all([
          getDocs(query(collection(db, 'sessions'), where('studentId', '==', profile.uid))),
          getDocs(query(collection(db, 'pvreports'), where('studentId', '==', profile.uid))),
        ])
        const sorted = sessSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Session)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setSessions(sorted)
        setReports(repSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PVReport))
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [profile])

  const avgGrade = reports.length > 0
    ? (reports.reduce((s, r) => s + r.cijfer, 0) / reports.length).toFixed(1)
    : null

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const sessionHref = (session: Session) =>
    session.status === 'evaluated' ? `/student/results/${session.id}` :
    session.status === 'writing_pv' ? `/student/pv-editor/${session.id}` :
    `/student/interview/${session.id}`

  return (
    <div className="min-h-screen bg-student-cream">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-student-indigo rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">PV Trainer</h1>
              <p className="text-xs text-gray-500 truncate max-w-[160px] sm:max-w-none">Student — {profile?.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 p-2 sm:px-3 sm:py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Uitloggen</span>
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AttentionNoteBanner profile={profile} />
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-student-tint rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-student-indigo" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Sessies</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{sessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Ingediend</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">
              {sessions.filter(s => s.status === 'evaluated' || s.status === 'submitted').length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Gem. cijfer</p>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold ${avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}`}>
              {avgGrade ?? '—'}
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="mb-6 sm:mb-8">
          <Link
            href="/student/cases"
            className="inline-flex items-center gap-2 bg-student-indigo text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-student-indigo-dark transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nieuwe oefening starten
          </Link>
        </div>

        {/* Sessions */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mijn oefeningen</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-student-indigo border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-700 mb-1">Nog geen oefeningen</p>
            <p className="text-sm text-gray-400">Start je eerste sessie om hier je voortgang te zien.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(session => {
              const report = reports.find(r => r.sessionId === session.id)
              const href = sessionHref(session)
              return (
                <div
                  key={session.id}
                  className="relative bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between active:bg-gray-50 transition-colors"
                >
                  {/* Invisible overlay link covers entire card — guaranteed tappable on iOS */}
                  <Link href={href} className="absolute inset-0 rounded-xl" aria-label={session.caseTitle} />
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      session.status === 'evaluated' ? 'bg-emerald-500' :
                      session.status === 'submitted' ? 'bg-amber-400' :
                      session.status === 'writing_pv' ? 'bg-student-indigo' :
                      'bg-gray-300'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{session.caseTitle}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(session.createdAt)} · {statusLabel(session.status)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    {report && (
                      <span className={`text-xl font-bold ${gradeColor(report.cijfer)}`}>
                        {report.cijfer.toFixed(1)}
                      </span>
                    )}
                    <span className="relative bg-student-indigo text-white px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap">
                      {session.status === 'evaluated' ? 'Bekijken' :
                       session.status === 'writing_pv' ? 'PV schrijven' :
                       'Doorgaan'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
