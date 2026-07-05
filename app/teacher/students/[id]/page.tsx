'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Session, PVReport, UserProfile, Case, ScoreCategory, SCORE_CATEGORY_LABELS } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { authFetch } from '@/lib/api-client'
import { gradeColor, formatDate, statusLabel, crimeTypeLabel } from '@/lib/utils'
import { Shield, ArrowLeft, CheckCircle, ChevronDown, ChevronUp, AlertCircle, BookOpen, FileText, TrendingUp, Save } from 'lucide-react'
import Link from 'next/link'

const now = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: now,
  updatedAt: now,
}))

const SCORE_CATS = [
  { key: 'formalia', label: 'Formalia', max: 15 },
  { key: 'zeven_w', label: "7 W's", max: 25 },
  { key: 'getuigenverklaring', label: 'Verklaring', max: 20 },
  { key: 'delictsomschrijving', label: 'Delict', max: 15 },
  { key: 'objectiviteit', label: 'Objectiviteit', max: 10 },
  { key: 'doorvragen', label: 'Doorvragen', max: 15 },
]

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [student, setStudent] = useState<UserProfile | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [reports, setReports] = useState<PVReport[]>([])
  const [cases, setCases] = useState<Record<string, Case>>({})
  const [expanded, setExpanded] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [classGroup, setClassGroup] = useState('')
  const [attentionNote, setAttentionNote] = useState('')
  const [focusAreas, setFocusAreas] = useState<ScoreCategory[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [profileSnap, sessSnap, repSnap] = await Promise.all([
          getDoc(doc(db, 'profiles', id)),
          getDocs(query(collection(db, 'sessions'), where('studentId', '==', id))),
          getDocs(query(collection(db, 'pvreports'), where('studentId', '==', id))),
        ])

        if (profileSnap.exists()) {
          const p = profileSnap.data() as UserProfile
          setStudent(p)
          setClassGroup(p.classGroup ?? '')
          setAttentionNote(p.attentionNote ?? '')
          setFocusAreas(p.focusAreas ?? [])
        }

        const sessData = sessSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Session)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const repData = repSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PVReport)
        setSessions(sessData)
        setReports(repData)

        const caseIds = [...new Set(sessData.map(s => s.caseId))]
        const caseMap: Record<string, Case> = {}
        await Promise.all(caseIds.map(async cid => {
          if (cid.startsWith('builtin_')) {
            const memCase = MEMORY_CASES.find(c => c.id === cid)
            if (memCase) caseMap[cid] = memCase
          } else {
            try {
              const snap = await getDoc(doc(db, 'cases', cid))
              if (snap.exists()) caseMap[cid] = { id: snap.id, ...snap.data() } as Case
            } catch {}
          }
        }))
        setCases(caseMap)
      } catch (err) {
        console.error('StudentDetailPage fetch error:', err)
        setLoadError(true)
      }
    }
    fetchData()
  }, [id])

  const avgGrade = reports.length > 0
    ? (reports.reduce((s, r) => s + r.cijfer, 0) / reports.length).toFixed(1)
    : null

  const toggleFocusArea = (cat: ScoreCategory) => {
    setFocusAreas(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat])
    setSaved(false)
  }

  const saveCustomization = async () => {
    setSaving(true)
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classGroup, attentionNote, focusAreas }),
      })
      if (!res.ok) throw new Error()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      // Keep it simple — the fields stay editable, teacher can just retry
    } finally {
      setSaving(false)
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <p className="font-medium text-gray-900 mb-1">Gegevens konden niet worden geladen</p>
          <p className="text-sm text-gray-500 mb-4">Controleer je verbinding en probeer opnieuw.</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-teacher-ink text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teacher-ink-dark transition-colors"
          >
            Opnieuw proberen
          </button>
        </div>
      </div>
    )
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-teacher-ink border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-teacher-paper">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/teacher/dashboard" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-teacher-ink rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">{student.name}</h1>
            <p className="text-xs text-gray-500">{student.email}</p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Sessies</p>
            </div>
            <p className="font-mono text-2xl sm:text-3xl font-bold text-gray-900">{sessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Beoordeeld</p>
            </div>
            <p className="font-mono text-2xl sm:text-3xl font-bold text-gray-900">{reports.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Gem. cijfer</p>
            </div>
            <p className={`font-mono text-2xl sm:text-3xl font-bold ${avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}`}>
              {avgGrade ?? '—'}
            </p>
          </div>
        </div>

        {/* Customization — standing per-student settings */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5 mb-6 sm:mb-8">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Aanpassingen voor deze student
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Klas / groep</label>
              <input
                type="text"
                value={classGroup}
                onChange={e => { setClassGroup(e.target.value); setSaved(false) }}
                placeholder="Bijv. Klas 2B"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teacher-ink focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Aandachtspunt (zichtbaar voor student + gebruikt bij beoordeling)
              </label>
              <textarea
                value={attentionNote}
                onChange={e => { setAttentionNote(e.target.value); setSaved(false) }}
                placeholder="Bijv. Let extra op het uitschrijven van de zeven W-vragen."
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teacher-ink focus:border-transparent resize-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Focuscategorieën (extra aandacht bij beoordeling)
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(SCORE_CATEGORY_LABELS) as ScoreCategory[]).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleFocusArea(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      focusAreas.includes(cat)
                        ? 'border-teacher-ink bg-teacher-tint text-teacher-ink'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {SCORE_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={saveCustomization}
                disabled={saving}
                className="inline-flex items-center gap-2 bg-teacher-ink text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teacher-ink-dark disabled:opacity-60 transition-colors"
              >
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Opslaan...' : 'Opslaan'}
              </button>
              {saved && <span className="text-xs text-teacher-ink font-medium">✓ Opgeslagen</span>}
            </div>
          </div>
        </div>

        {/* Sessions */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Alle sessies</p>

        {sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-700 mb-1">Nog geen sessies</p>
            <p className="text-sm text-gray-400">Deze student heeft nog geen oefeningen gestart.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const report = reports.find(r => r.sessionId === session.id)
              const caseInfo = cases[session.caseId]
              const isExpanded = expanded === session.id
              const evaluated = session.status === 'evaluated'

              return (
                <div key={session.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Row header */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        evaluated ? 'bg-emerald-500' :
                        session.status === 'submitted' ? 'bg-amber-400' : 'bg-gray-300'
                      }`} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{session.caseTitle}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-400">{formatDate(session.createdAt)}</p>
                          {caseInfo && (
                            <>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400">{crimeTypeLabel(caseInfo.crimeType)}</span>
                              <span className="text-gray-300">·</span>
                              <span className="text-xs text-gray-400">
                                {caseInfo.intervieweeType === 'verdachte' ? 'Verdachte' : 'Getuige'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      {report && (
                        <span className={`text-xl font-bold ${gradeColor(report.cijfer)}`}>
                          {report.cijfer.toFixed(1)}
                        </span>
                      )}
                      {!evaluated && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                          {statusLabel(session.status)}
                        </span>
                      )}
                      {report && (
                        <button
                          onClick={() => setExpanded(isExpanded ? null : session.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && report && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {/* Score grid */}
                      <div className="p-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {SCORE_CATS.map(cat => {
                          const score = report.scoresBreakdown[cat.key as keyof typeof report.scoresBreakdown] ?? 0
                          const pct = (score / cat.max) * 100
                          const color = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                          const bg = pct >= 70 ? 'bg-emerald-50 border-emerald-100' : pct >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                          return (
                            <div key={cat.key} className={`rounded-lg border ${bg} p-2.5 text-center`}>
                              <p className="text-xs text-gray-500 leading-tight mb-1">{cat.label}</p>
                              <p className={`text-base font-bold ${color}`}>{score}</p>
                              <p className="text-xs text-gray-400">/{cat.max}</p>
                            </div>
                          )
                        })}
                      </div>

                      {/* General feedback */}
                      <div className="px-4 pb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Algemene feedback</p>
                        <p className="text-sm text-gray-700 bg-white border border-gray-100 rounded-lg px-3.5 py-3 leading-relaxed">
                          {report.generalFeedback}
                        </p>
                      </div>

                      {/* Transcript */}
                      <div className="px-4 pb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">
                          Interview — {session.transcript.length} berichten
                        </p>
                        <div className="bg-white border border-gray-100 rounded-lg p-3 max-h-52 overflow-y-auto space-y-2.5">
                          {session.transcript.length === 0 ? (
                            <p className="text-xs text-gray-400">Geen transcript beschikbaar.</p>
                          ) : session.transcript.map((msg, i) => (
                            <div key={i} className={`flex gap-2 ${msg.role === 'student' ? '' : 'flex-row-reverse'}`}>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                msg.role === 'student' ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {msg.role === 'student' ? 'A' : 'G'}
                              </div>
                              <p className={`text-xs rounded-lg px-2.5 py-1.5 max-w-xs ${
                                msg.role === 'student'
                                  ? 'bg-blue-50 text-blue-900'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {msg.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Submitted PV */}
                      <div className="px-4 pb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Ingediend PV</p>
                        <pre className="bg-white border border-gray-100 rounded-lg px-3.5 py-3 text-xs text-gray-700 font-mono whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
                          {report.content}
                        </pre>
                      </div>
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
