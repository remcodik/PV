'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PVReport, UserProfile, Session } from '@/lib/types'
import { Shield, ArrowLeft, FileText } from 'lucide-react'
import { formatDate, gradeColor } from '@/lib/utils'
import Link from 'next/link'

export default function AllPVReportsPage() {
  const [reports, setReports] = useState<PVReport[]>([])
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const [repSnap, profSnap, sessSnap] = await Promise.all([
        getDocs(collection(db, 'pvreports')),
        getDocs(collection(db, 'profiles')),
        getDocs(collection(db, 'sessions')),
      ])
      const profMap: Record<string, UserProfile> = {}
      profSnap.docs.forEach(d => { profMap[d.id] = d.data() as UserProfile })
      const sessMap: Record<string, Session> = {}
      sessSnap.docs.forEach(d => { sessMap[d.id] = { id: d.id, ...d.data() } as Session })
      setProfiles(profMap)
      setSessions(sessMap)
      setReports(
        repSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as PVReport)
          .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
      )
      setLoading(false)
    }
    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-teacher-paper">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/teacher/dashboard" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-teacher-ink rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Alle PV's</h1>
            <p className="text-xs text-gray-500">{reports.length} PV's totaal</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-teacher-ink border-t-transparent rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nog geen PV's ingediend.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const student = profiles[r.studentId]
              const session = sessions[r.sessionId]
              const isOpen = expanded === r.id
              return (
                <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-teacher-tint flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-teacher-ink">
                        {student?.name?.charAt(0).toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{session?.caseTitle ?? 'Onbekende case'}</p>
                      <p className="text-xs text-gray-400">{student?.name ?? r.studentId} · {formatDate(r.submittedAt)}</p>
                    </div>
                    <span className={`text-xl font-bold flex-shrink-0 ${gradeColor(r.cijfer)}`}>
                      {r.cijfer.toFixed(1)}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4 space-y-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Feedback</p>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3.5 py-3 leading-relaxed">
                          {r.generalFeedback}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ingediend PV</p>
                        <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap bg-gray-50 rounded-lg px-3.5 py-3 max-h-64 overflow-y-auto leading-relaxed">
                          {r.content}
                        </pre>
                      </div>
                      <Link
                        href={`/teacher/students/${r.studentId}`}
                        className="inline-flex items-center gap-1.5 text-xs text-teacher-ink hover:text-teacher-ink font-medium"
                      >
                        Bekijk alle sessies van {student?.name ?? 'student'} →
                      </Link>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
