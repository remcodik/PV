'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Session, Case, PVReport } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { useAuth } from '@/contexts/AuthContext'
import { gradeColor, formatDate } from '@/lib/utils'
import { Shield, CheckCircle, AlertCircle, ArrowLeft, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import Link from 'next/link'

const now = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: now,
  updatedAt: now,
}))

function loadLocalReport(sessionId: string): PVReport | null {
  try {
    const raw = localStorage.getItem(`pvreport_report_${sessionId}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function loadLocalSession(id: string): Session | null {
  try {
    const raw = localStorage.getItem(`session_${id}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function ResultsPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const [session, setSession] = useState<Session | null>(null)
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [report, setReport] = useState<PVReport | null>(null)
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5]))
  const [accessDenied, setAccessDenied] = useState(false)
  const isLocal = id.startsWith('local_')

  useEffect(() => {
    if (authLoading) return
    const fetchData = async () => {
      try {
        if (isLocal) {
          const localSess = loadLocalSession(id)
          if (!localSess) return
          setSession(localSess)
          const memCase = MEMORY_CASES.find(c => c.id === localSess.caseId)
          if (memCase) setCaseData(memCase)
          else {
            try {
              const caseDoc = await getDoc(doc(db, 'cases', localSess.caseId))
              if (caseDoc.exists()) setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
            } catch {}
          }
          const localReport = loadLocalReport(id)
          if (localReport) setReport(localReport)
          return
        }

        let sessData: Session | null = null
        try {
          const sessDoc = await getDoc(doc(db, 'sessions', id))
          if (sessDoc.exists()) sessData = { id: sessDoc.id, ...sessDoc.data() } as Session
        } catch {}
        if (!sessData) sessData = loadLocalSession(id)
        if (!sessData) return
        if (profile?.role !== 'teacher' && sessData.studentId !== profile?.uid) {
          setAccessDenied(true)
          return
        }
        setSession(sessData)

        if (sessData.caseId.startsWith('builtin_')) {
          const memCase = MEMORY_CASES.find(c => c.id === sessData.caseId)
          if (memCase) setCaseData(memCase)
        } else {
          const caseDoc = await getDoc(doc(db, 'cases', sessData.caseId))
          if (caseDoc.exists()) setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
        }

        try {
          const repSnap = await getDocs(query(collection(db, 'pvreports'), where('sessionId', '==', id)))
          if (!repSnap.empty) {
            setReport({ id: repSnap.docs[0].id, ...repSnap.docs[0].data() } as PVReport)
          } else {
            const localReport = loadLocalReport(id)
            if (localReport) setReport(localReport)
          }
        } catch {
          const localReport = loadLocalReport(id)
          if (localReport) setReport(localReport)
        }
      } catch (err) {
        console.error('fetchData error:', err)
      }
    }
    fetchData()
  }, [id, isLocal, authLoading, profile?.uid, profile?.role])

  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-semibold text-gray-900">Geen toegang</p>
        <p className="text-sm text-gray-500 max-w-xs">Dit resultaat is niet van jouw account.</p>
        <button onClick={() => router.replace('/student/dashboard')} className="text-sm text-blue-600 hover:underline">
          Terug naar dashboard
        </button>
      </div>
    )
  }

  if (!session || !caseData || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const scoreCategories = [
    { key: 'formalia', label: 'Formalia', max: 15 },
    { key: 'zeven_w', label: 'Zeven W', max: 25 },
    { key: 'getuigenverklaring', label: 'Verklaring', max: 20 },
    { key: 'delictsomschrijving', label: 'Delict', max: 15 },
    { key: 'objectiviteit', label: 'Objectiviteit', max: 10 },
    { key: 'doorvragen', label: 'Doorvragen', max: 15 },
  ]

  const gradeNum = report.cijfer
  const gradeBg = gradeNum >= 8 ? 'bg-emerald-50 border-emerald-100' :
                  gradeNum >= 6 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
  const gradeBar = gradeNum >= 8 ? 'bg-emerald-500' :
                   gradeNum >= 6 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/student/dashboard" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Beoordeling</h1>
            <p className="text-xs text-gray-500 truncate">{caseData.title}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-5">
        {/* Grade card */}
        <div className={`rounded-xl border ${gradeBg} p-6`}>
          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Eindcijfer</p>
              <p className={`text-6xl font-bold leading-none ${gradeColor(gradeNum)}`}>
                {gradeNum.toFixed(1)}
              </p>
              <p className="text-sm text-gray-400 mt-2">{report.totalScore} / 100 punten</p>
            </div>
            <div className="text-right text-xs text-gray-400">
              {formatDate(report.evaluatedAt!)}
            </div>
          </div>
          <div className="bg-white/60 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${gradeBar}`}
              style={{ width: `${report.totalScore}%` }}
            />
          </div>
        </div>

        {/* Score breakdown — mini grid */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {scoreCategories.map(cat => {
            const score = report.scoresBreakdown[cat.key as keyof typeof report.scoresBreakdown] ?? 0
            const pct = (score / cat.max) * 100
            const color = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
            const bg = pct >= 70 ? 'bg-emerald-50 border-emerald-100' : pct >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
            return (
              <div key={cat.key} className={`rounded-lg border ${bg} p-3 text-center`}>
                <p className="text-xs text-gray-500 mb-1 leading-tight">{cat.label}</p>
                <p className={`text-lg font-bold ${color}`}>{score}</p>
                <p className="text-xs text-gray-400">/{cat.max}</p>
              </div>
            )
          })}
        </div>

        {/* General feedback */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5">
          <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2">Algemene feedback</p>
          <p className="text-sm text-blue-900 leading-relaxed">{report.generalFeedback}</p>
        </div>

        {/* Detailed feedback */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Feedback per categorie</p>

          {(!report.feedback || report.feedback.length === 0) && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800 mb-3">
              Gedetailleerde feedback is niet beschikbaar. Dien het PV opnieuw in om volledige feedback te ontvangen.
            </div>
          )}

          <div className="space-y-2">
            {(report.feedback ?? []).map((item, i) => {
              const pct = item.score / item.maxScore
              const good = pct >= 0.7
              const iconBg = good ? 'bg-emerald-50' : pct >= 0.5 ? 'bg-amber-50' : 'bg-red-50'
              const barColor = good ? 'bg-emerald-500' : pct >= 0.5 ? 'bg-amber-500' : 'bg-red-500'
              const scoreColor = good ? 'text-emerald-600' : pct >= 0.5 ? 'text-amber-600' : 'text-red-600'
              return (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpanded(prev => {
                      const s = new Set(prev)
                      s.has(i) ? s.delete(i) : s.add(i)
                      return s
                    })}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                        {good
                          ? <CheckCircle className="w-4 h-4 text-emerald-600" />
                          : <AlertCircle className="w-4 h-4 text-amber-600" />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{item.category}</p>
                        <div className="w-24 h-1 bg-gray-100 rounded-full mt-1">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct * 100}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <span className={`text-sm font-bold ${scoreColor}`}>{item.score}</span>
                      <span className="text-xs text-gray-400">/{item.maxScore}</span>
                      {expanded.has(i)
                        ? <ChevronUp className="w-4 h-4 text-gray-400" />
                        : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {expanded.has(i) && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                      <p className="text-sm text-gray-700 leading-relaxed mb-3">{item.feedback}</p>
                      {item.suggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Verbeterpunten</p>
                          <ul className="space-y-1.5">
                            {item.suggestions.map((s, j) => (
                              <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                                <span className="text-blue-400 mt-0.5 flex-shrink-0">›</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Submitted PV */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100">
            <FileText className="w-4 h-4 text-gray-400" />
            <p className="text-sm font-semibold text-gray-700">Jouw ingediende PV</p>
          </div>
          <pre className="p-5 text-sm text-gray-600 font-mono leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {report.content}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href={`/student/pv-editor/${id}`}
            className="flex-1 text-center border border-blue-600 text-blue-600 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            <span className="sm:hidden">PV aanpassen</span>
            <span className="hidden sm:inline">PV aanpassen en opnieuw indienen</span>
          </Link>
          <Link
            href="/student/cases"
            className="flex-1 text-center bg-blue-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <span className="sm:hidden">Nieuwe oefening</span>
            <span className="hidden sm:inline">Nieuwe oefening starten</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
