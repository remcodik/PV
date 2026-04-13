'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Session, Case, PVReport } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { gradeColor, formatDate } from '@/lib/utils'
import { Shield, CheckCircle, AlertCircle, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'
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
  const [session, setSession] = useState<Session | null>(null)
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [report, setReport] = useState<PVReport | null>(null)
  const [expanded, setExpanded] = useState<number | null>(0)
  const isLocal = id.startsWith('local_')

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (isLocal) {
          // Load session from localStorage
          const localSess = loadLocalSession(id)
          if (!localSess) return
          setSession(localSess)

          // Load case from memory
          const memCase = MEMORY_CASES.find(c => c.id === localSess.caseId)
          if (memCase) setCaseData(memCase)
          else {
            try {
              const caseDoc = await getDoc(doc(db, 'cases', localSess.caseId))
              if (caseDoc.exists()) setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
            } catch {}
          }

          // Load report from localStorage
          const localReport = loadLocalReport(id)
          if (localReport) setReport(localReport)
          return
        }

        // Firestore flow
        const sessDoc = await getDoc(doc(db, 'sessions', id))
        if (!sessDoc.exists()) return
        const sessData = { id: sessDoc.id, ...sessDoc.data() } as Session
        setSession(sessData)

        // Load case
        if (sessData.caseId.startsWith('builtin_')) {
          const memCase = MEMORY_CASES.find(c => c.id === sessData.caseId)
          if (memCase) setCaseData(memCase)
        } else {
          const caseDoc = await getDoc(doc(db, 'cases', sessData.caseId))
          if (caseDoc.exists()) setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
        }

        // Load report from Firestore, fall back to localStorage
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
  }, [id, isLocal])

  if (!session || !caseData || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const scoreCategories = [
    { key: 'formalia', label: 'Formalia', max: 15 },
    { key: 'zeven_w', label: 'Zeven W', max: 25 },
    { key: 'getuigenverklaring', label: 'Getuigen-verklaring', max: 20 },
    { key: 'delictsomschrijving', label: 'Delicts-omschrijving', max: 15 },
    { key: 'objectiviteit', label: 'Objectiviteit', max: 10 },
    { key: 'doorvragen', label: 'Doorvragen', max: 15 },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/student/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Resultaat</h1>
            <p className="text-xs text-gray-500">{caseData.title}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Grade card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-2">Jouw cijfer</p>
          <p className={`text-7xl font-bold mb-2 ${gradeColor(report.cijfer)}`}>
            {report.cijfer.toFixed(1)}
          </p>
          <p className="text-gray-400 text-sm">{report.totalScore}/100 punten</p>
          <div className="mt-4 bg-gray-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                report.cijfer >= 8 ? 'bg-green-500' :
                report.cijfer >= 6 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${report.totalScore}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-4">{formatDate(report.evaluatedAt!)}</p>
        </div>

        {/* General feedback */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h3 className="font-semibold text-blue-900 mb-2">Algemene feedback</h3>
          <p className="text-blue-800 text-sm leading-relaxed">{report.generalFeedback}</p>
        </div>

        {/* Score breakdown */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">Scores per categorie</h3>

          {/* Grid overview */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-4">
            {scoreCategories.map(cat => {
              const score = report.scoresBreakdown[cat.key as keyof typeof report.scoresBreakdown]
              const pct = (score / cat.max) * 100
              return (
                <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1 leading-tight">{cat.label}</p>
                  <p className={`text-xl font-bold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {score}
                  </p>
                  <p className="text-xs text-gray-400">/{cat.max}</p>
                </div>
              )
            })}
          </div>

          {/* Detailed feedback per category */}
          <div className="space-y-3">
            {report.feedback.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      (item.score / item.maxScore) >= 0.7 ? 'bg-green-100' :
                      (item.score / item.maxScore) >= 0.5 ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      {(item.score / item.maxScore) >= 0.7
                        ? <CheckCircle className="w-4 h-4 text-green-600" />
                        : <AlertCircle className="w-4 h-4 text-red-600" />}
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900 text-sm">{item.category}</p>
                      <div className="w-32 h-1.5 bg-gray-100 rounded-full mt-1">
                        <div
                          className={`h-full rounded-full ${
                            (item.score / item.maxScore) >= 0.7 ? 'bg-green-500' :
                            (item.score / item.maxScore) >= 0.5 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${(item.score / item.maxScore) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-700">{item.score}/{item.maxScore}</span>
                    {expanded === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>
                {expanded === i && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <p className="text-sm text-gray-700 mb-3">{item.feedback}</p>
                    {item.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Verbeterpunten:</p>
                        <ul className="space-y-1">
                          {item.suggestions.map((s, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="text-blue-500 mt-0.5">•</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Your PV */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-900">Jouw ingediende PV</h3>
          </div>
          <pre className="p-5 text-sm text-gray-700 font-mono leading-relaxed whitespace-pre-wrap">
            {report.content}
          </pre>
        </div>

        <Link
          href="/student/cases"
          className="block w-full text-center bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          Nog een oefening starten
        </Link>
      </div>
    </div>
  )
}
