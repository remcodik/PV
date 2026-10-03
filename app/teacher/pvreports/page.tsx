'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { PVReport, UserProfile, Session } from '@/lib/types'
import { Shield, ArrowLeft, FileText, Lightbulb, Download } from 'lucide-react'
import { formatDate, gradeColor } from '@/lib/utils'
import Link from 'next/link'
import { Card, EmptyState } from '@/app/components/ui/Card'
import { Spinner } from '@/app/components/ui/Spinner'

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

  // Client-side CSV generation — all the data is already loaded, no
  // need for a server round-trip. Quotes every field so student names
  // or case titles containing a comma don't break the column layout.
  const exportCsv = () => {
    const csvQuote = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const header = ['Student', 'Klas', 'Case', 'Datum', 'Cijfer', 'Formalia', "7 W's", 'Verklaring', 'Delict', 'Objectiviteit', 'Doorvragen']
    const rows = reports.map(r => {
      const student = profiles[r.studentId]
      const session = sessions[r.sessionId]
      const sb = r.scoresBreakdown
      return [
        student?.name ?? r.studentId,
        student?.classGroup ?? '',
        session?.caseTitle ?? '',
        formatDate(r.submittedAt),
        r.cijfer.toFixed(1),
        sb?.formalia ?? '', sb?.zeven_w ?? '', sb?.getuigenverklaring ?? '',
        sb?.delictsomschrijving ?? '', sb?.objectiviteit ?? '', sb?.doorvragen ?? '',
      ].map(csvQuote).join(',')
    })
    const csv = [header.map(csvQuote).join(','), ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }) // BOM for Excel
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `pv-cijfers-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/teacher/dashboard" className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-ink-800 rounded-md flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="font-semibold text-gray-900">Alle PV&apos;s</h1>
            <p className="text-xs text-gray-500">{reports.length} PV&apos;s totaal</p>
          </div>
          {reports.length > 0 && (
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Exporteer CSV
            </button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : reports.length === 0 ? (
          <EmptyState icon={FileText} title="Nog geen PV's" description="Er zijn nog geen PV's ingediend." />
        ) : (
          <div className="space-y-3">
            {reports.map(r => {
              const student = profiles[r.studentId]
              const session = sessions[r.sessionId]
              const isOpen = expanded === r.id
              return (
                <Card key={r.id} className="overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-ink-700">
                        {student?.name?.charAt(0).toUpperCase() ?? '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900 truncate">{session?.caseTitle ?? 'Onbekende case'}</p>
                        {(student?.attentionNote || (student?.focusAreas?.length ?? 0) > 0) && (
                          <Lightbulb
                            className="w-3.5 h-3.5 text-amber-500 flex-shrink-0"
                            aria-label="Student heeft een actief aandachtspunt"
                          />
                        )}
                        {session?.isPractice && (
                          <span className="text-[10px] bg-gold-100 text-gold-700 px-1.5 py-0.5 rounded-md font-medium flex-shrink-0">
                            Oefensessie
                          </span>
                        )}
                      </div>
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
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-md px-3.5 py-3 leading-relaxed">
                          {r.generalFeedback}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Ingediend PV</p>
                        <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap bg-gray-50 rounded-md px-3.5 py-3 max-h-64 overflow-y-auto leading-relaxed">
                          {r.content}
                        </pre>
                      </div>
                      <Link
                        href={`/teacher/students/${r.studentId}`}
                        className="inline-flex items-center gap-1.5 text-xs text-ink-700 hover:text-ink-900 font-medium"
                      >
                        Bekijk alle sessies van {student?.name ?? 'student'} →
                      </Link>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
