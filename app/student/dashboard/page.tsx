'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, PVReport } from '@/lib/types'
import { formatDate, statusLabel, gradeColor } from '@/lib/utils'
import { Shield, BookOpen, CheckCircle, Clock, Plus, LogOut } from 'lucide-react'
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
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <LogOut className="w-4 h-4" />
            Uitloggen
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Sessies</p>
            <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Ingediend</p>
            <p className="text-3xl font-bold text-gray-900">
              {sessions.filter(s => s.status === 'evaluated' || s.status === 'submitted').length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Gemiddeld cijfer</p>
            <p className={`text-3xl font-bold ${avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-400'}`}>
              {avgGrade ?? '—'}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mb-8">
          <Link
            href="/student/cases"
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nieuwe oefening starten
          </Link>
        </div>

        {/* Sessions */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Mijn oefeningen</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nog geen oefeningen. Start je eerste sessie!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const report = reports.find(r => r.sessionId === session.id)
              return (
                <div
                  key={session.id}
                  className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-gray-900">{session.caseTitle}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{formatDate(session.createdAt)}</p>
                    <span className={`inline-flex items-center gap-1 text-xs mt-2 px-2 py-0.5 rounded-full font-medium ${
                      session.status === 'evaluated' ? 'bg-green-100 text-green-700' :
                      session.status === 'submitted' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {session.status === 'evaluated' ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {statusLabel(session.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    {report && (
                      <div className="text-right">
                        <p className={`text-2xl font-bold ${gradeColor(report.cijfer)}`}>
                          {report.cijfer.toFixed(1)}
                        </p>
                        <p className="text-xs text-gray-400">cijfer</p>
                      </div>
                    )}
                    <Link
                      href={
                        session.status === 'evaluated' ? `/student/results/${session.id}` :
                        session.status === 'writing_pv' ? `/student/pv-editor/${session.id}` :
                        `/student/interview/${session.id}`
                      }
                      className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
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
