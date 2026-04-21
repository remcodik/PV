'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, PVReport } from '@/lib/types'
import { formatDate, statusLabel, gradeColor } from '@/lib/utils'
import { Shield, BookOpen, CheckCircle, Clock, Plus, LogOut, TrendingUp } from 'lucide-react'
import Link from 'next/link'

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">PV Trainer</h1>
              <p className="text-xs text-gray-500">Student — {profile?.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Uitloggen
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-sm text-gray-500">Sessies</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm text-gray-500">Ingediend</p>
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {sessions.filter(s => s.status === 'evaluated' || s.status === 'submitted').length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-sm text-gray-500">Gem. cijfer</p>
            </div>
            <p className={`text-3xl font-bold ${avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}`}>
              {avgGrade ?? '—'}
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="mb-8">
          <Link
            href="/student/cases"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Nieuwe oefening starten
          </Link>
        </div>

        {/* Sessions */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Mijn oefeningen</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
              return (
                <div
                  key={session.id}
                  className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      session.status === 'evaluated' ? 'bg-emerald-500' :
                      session.status === 'submitted' ? 'bg-amber-400' :
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
                    <Link
                      href={
                        session.status === 'evaluated' ? `/student/results/${session.id}` :
                        session.status === 'writing_pv' ? `/student/pv-editor/${session.id}` :
                        `/student/interview/${session.id}`
                      }
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    >
                      {session.status === 'evaluated' ? 'Bekijken' :
                       session.status === 'writing_pv' ? 'PV schrijven' :
                       'Doorgaan'}
                    </Link>
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
