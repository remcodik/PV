'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Session, PVReport, UserProfile, Case } from '@/lib/types'
import { gradeColor, formatDate, statusLabel } from '@/lib/utils'
import { Shield, ArrowLeft, CheckCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import Link from 'next/link'

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [reports, setReports] = useState<PVReport[]>([])
  const [cases, setCases] = useState<Record<string, Case>>({})
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const [profileSnap, sessSnap, repSnap] = await Promise.all([
        getDoc(doc(db, 'profiles', id)),
        getDocs(query(collection(db, 'sessions'), where('studentId', '==', id))),
        getDocs(query(collection(db, 'pvreports'), where('studentId', '==', id))),
      ])
      if (profileSnap.exists()) setStudent(profileSnap.data() as UserProfile)
      const sessData = sessSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Session)
      const repData = repSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PVReport)
      setSessions(sessData)
      setReports(repData)

      // Load cases
      const caseIds = [...new Set(sessData.map(s => s.caseId))]
      const caseMap: Record<string, Case> = {}
      await Promise.all(caseIds.map(async cid => {
        const snap = await getDoc(doc(db, 'cases', cid))
        if (snap.exists()) caseMap[cid] = { id: snap.id, ...snap.data() } as Case
      }))
      setCases(caseMap)
    }
    fetchData()
  }, [id])

  const avgGrade = reports.length > 0
    ? (reports.reduce((s, r) => s + r.cijfer, 0) / reports.length).toFixed(1)
    : null

  if (!student) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Laden...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/teacher/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{student.name}</h1>
            <p className="text-xs text-gray-500">{student.email}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Sessies</p>
            <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Beoordeeld</p>
            <p className="text-3xl font-bold text-gray-900">{reports.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">Gem. cijfer</p>
            <p className={`text-3xl font-bold ${avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}`}>
              {avgGrade ?? '—'}
            </p>
          </div>
        </div>

        {/* Sessions */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Alle sessies</h2>
        <div className="space-y-4">
          {sessions.map(session => {
            const report = reports.find(r => r.sessionId === session.id)
            const isExpanded = expanded === session.id
            return (
              <div key={session.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{session.caseTitle}</p>
                      <p className="text-sm text-gray-400 mt-0.5">{formatDate(session.createdAt)}</p>
                      <span className={`inline-flex items-center gap-1 text-xs mt-2 px-2 py-0.5 rounded-full ${
                        session.status === 'evaluated' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
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
                      {report && (
                        <button onClick={() => setExpanded(isExpanded ? null : session.id)}
                          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && report && (
                  <div className="border-t border-gray-100 bg-gray-50">
                    {/* Scores */}
                    <div className="p-5 grid grid-cols-5 gap-3">
                      {[
                        { key: 'formalia', label: 'Formalia', max: 20 },
                        { key: 'zeven_w', label: '7 W\'s', max: 30 },
                        { key: 'getuigenverklaring', label: 'Getuige', max: 25 },
                        { key: 'delictsomschrijving', label: 'Delict', max: 15 },
                        { key: 'objectiviteit', label: 'Object.', max: 10 },
                      ].map(cat => {
                        const score = report.scoresBreakdown[cat.key as keyof typeof report.scoresBreakdown]
                        const pct = (score / cat.max) * 100
                        return (
                          <div key={cat.key} className="bg-white rounded-lg border border-gray-200 p-3 text-center">
                            <p className="text-xs text-gray-400">{cat.label}</p>
                            <p className={`text-lg font-bold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                              {score}
                            </p>
                            <p className="text-xs text-gray-400">/{cat.max}</p>
                          </div>
                        )
                      })}
                    </div>

                    {/* Feedback */}
                    <div className="px-5 pb-5">
                      <p className="text-sm font-medium text-gray-700 mb-2">Feedback:</p>
                      <p className="text-sm text-gray-600 bg-white rounded-lg border border-gray-200 p-3">
                        {report.generalFeedback}
                      </p>
                    </div>

                    {/* Transcript preview */}
                    <div className="px-5 pb-5">
                      <p className="text-sm font-medium text-gray-700 mb-2">
                        Interview ({session.transcript.length} berichten):
                      </p>
                      <div className="bg-white rounded-lg border border-gray-200 p-3 max-h-48 overflow-y-auto space-y-2">
                        {session.transcript.map((msg, i) => (
                          <div key={i}>
                            <p className="text-xs font-semibold text-gray-500">
                              {msg.role === 'student' ? 'Agent' : 'Getuige'}
                            </p>
                            <p className="text-xs text-gray-700">{msg.content}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* PV */}
                    <div className="px-5 pb-5">
                      <p className="text-sm font-medium text-gray-700 mb-2">Ingediend PV:</p>
                      <pre className="bg-white rounded-lg border border-gray-200 p-3 text-xs text-gray-700 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {report.content}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
