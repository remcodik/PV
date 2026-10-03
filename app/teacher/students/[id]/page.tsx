'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Session, PVReport, UserProfile, Case, ScoreCategory, SCORE_CATEGORY_LABELS } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { authFetch } from '@/lib/api-client'
import { gradeColor, formatDate, statusLabel, crimeTypeLabel } from '@/lib/utils'
import { Shield, ArrowLeft, ChevronDown, ChevronUp, AlertCircle, BookOpen, FileText, TrendingUp, Save, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Card, EmptyState } from '@/app/components/ui/Card'
import { StatCard } from '@/app/components/ui/StatCard'
import { Button } from '@/app/components/ui/Button'
import { PageSpinner } from '@/app/components/ui/Spinner'

const now = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: now,
  updatedAt: now,
}))

const TECHNIQUE_LABEL_STYLE: Record<string, string> = {
  open: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  gesloten: 'bg-gray-50 text-gray-500 border-gray-200',
  suggestief: 'bg-red-50 text-red-700 border-red-200',
  samengesteld: 'bg-amber-50 text-amber-700 border-amber-200',
  neutraal: 'bg-gray-50 text-gray-400 border-gray-200',
}

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
  // Keyed by session id, since a teacher may expand/analyze several
  // sessions for the same student across one visit to this page.
  const [techniqueAnalysis, setTechniqueAnalysis] = useState<Record<string, { labels: (string | null)[]; summary: string }>>({})
  const [analyzing, setAnalyzing] = useState<string | null>(null)
  const [analyzeError, setAnalyzeError] = useState<Record<string, string>>({})
  // Which category cell is expanded, keyed "sessionId:categoryKey" so
  // multiple reports' expansions don't collide.
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

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

  const analyzeInterviewTechnique = async (session: Session) => {
    setAnalyzing(session.id)
    setAnalyzeError(prev => ({ ...prev, [session.id]: '' }))
    try {
      const res = await authFetch('/api/analyze-interview-technique', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: session.transcript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analyse mislukt')
      setTechniqueAnalysis(prev => ({ ...prev, [session.id]: { labels: data.labels, summary: data.summary } }))
    } catch (err) {
      setAnalyzeError(prev => ({ ...prev, [session.id]: err instanceof Error ? err.message : 'Analyse mislukt' }))
    } finally {
      setAnalyzing(null)
    }
  }

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
      <div className="min-h-screen flex items-center justify-center px-6 bg-paper">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-red-50 rounded-md flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6 text-red-500" />
          </div>
          <p className="font-medium text-gray-900 mb-1">Gegevens konden niet worden geladen</p>
          <p className="text-sm text-gray-500 mb-4">Controleer je verbinding en probeer opnieuw.</p>
          <Button onClick={() => window.location.reload()}>Opnieuw proberen</Button>
        </div>
      </div>
    )
  }

  if (!student) {
    return <PageSpinner />
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Link href="/teacher/dashboard" className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-ink-800 rounded-md flex items-center justify-center">
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
          <StatCard icon={BookOpen} label="Sessies" value={sessions.length} />
          <StatCard icon={FileText} label="Beoordeeld" value={reports.length} />
          <StatCard
            icon={TrendingUp}
            label="Gem. cijfer"
            value={avgGrade ?? '—'}
            valueClassName={avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}
          />
        </div>

        {/* Customization — standing per-student settings */}
        <Card className="p-4 sm:p-5 mb-6 sm:mb-8">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500/20 focus:border-ink-600 transition-colors"
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
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500/20 focus:border-ink-600 transition-colors resize-none"
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
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                      focusAreas.includes(cat)
                        ? 'border-ink-700 bg-ink-100 text-ink-700'
                        : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {SCORE_CATEGORY_LABELS[cat]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Button onClick={saveCustomization} disabled={saving} size="sm">
                {saving ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Opslaan...' : 'Opslaan'}
              </Button>
              {saved && <span className="text-xs text-ink-700 font-medium">✓ Opgeslagen</span>}
            </div>
          </div>
        </Card>

        {/* Sessions */}
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Alle sessies</p>

        {sessions.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nog geen sessies" description="Deze student heeft nog geen oefeningen gestart." />
        ) : (
          <div className="space-y-3">
            {sessions.map(session => {
              const report = reports.find(r => r.sessionId === session.id)
              const caseInfo = cases[session.caseId]
              const isExpanded = expanded === session.id
              const evaluated = session.status === 'evaluated'

              return (
                <Card key={session.id} className="overflow-hidden">
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
                        <span className={`text-xl font-bold font-mono ${gradeColor(report.cijfer)}`}>
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
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && report && (
                    <div className="border-t border-gray-100 bg-gray-50/50">
                      {/* Score grid — click a category for "waarom deze score?" */}
                      <div className="p-4 grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {SCORE_CATS.map(cat => {
                          const score = report.scoresBreakdown[cat.key as keyof typeof report.scoresBreakdown] ?? 0
                          const pct = (score / cat.max) * 100
                          const color = pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-red-600'
                          const bg = pct >= 70 ? 'bg-emerald-50 border-emerald-100' : pct >= 50 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'
                          const cellKey = `${session.id}:${cat.key}`
                          const detail = report.feedback?.find(f => f.category === cat.key)
                          return (
                            <button
                              key={cat.key}
                              onClick={() => detail && setExpandedCategory(expandedCategory === cellKey ? null : cellKey)}
                              className={`rounded-md border ${bg} p-2.5 text-center ${detail ? 'cursor-pointer hover:brightness-95' : 'cursor-default'} transition-[filter]`}
                            >
                              <p className="text-xs text-gray-500 leading-tight mb-1">{cat.label}</p>
                              <p className={`text-base font-bold font-mono ${color}`}>{score}</p>
                              <p className="text-xs text-gray-400">/{cat.max}</p>
                            </button>
                          )
                        })}
                      </div>

                      {/* "Waarom deze score?" detail for the clicked category */}
                      {SCORE_CATS.map(cat => {
                        const cellKey = `${session.id}:${cat.key}`
                        if (expandedCategory !== cellKey) return null
                        const detail = report.feedback?.find(f => f.category === cat.key)
                        if (!detail) return null
                        return (
                          <div key={cat.key} className="px-4 pb-3">
                            <div className="bg-white border border-gray-100 rounded-md px-3.5 py-3">
                              <p className="text-xs font-semibold text-gray-700 mb-1">Waarom deze score — {cat.label}</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{detail.feedback}</p>
                              {detail.suggestions?.length > 0 && (
                                <ul className="mt-2 space-y-1">
                                  {detail.suggestions.map((s, i) => (
                                    <li key={i} className="text-xs text-gray-500 flex gap-1.5">
                                      <span className="text-amber-500">→</span>{s}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          </div>
                        )
                      })}

                      {/* General feedback */}
                      <div className="px-4 pb-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Algemene feedback</p>
                        <p className="text-sm text-gray-700 bg-white border border-gray-100 rounded-md px-3.5 py-3 leading-relaxed">
                          {report.generalFeedback}
                        </p>
                      </div>

                      {/* Transcript */}
                      <div className="px-4 pb-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                            Interview — {session.transcript.length} berichten
                          </p>
                          {session.transcript.length > 0 && (
                            <button
                              onClick={() => analyzeInterviewTechnique(session)}
                              disabled={analyzing === session.id}
                              className="inline-flex items-center gap-1 text-xs text-amber-700 hover:underline disabled:opacity-40"
                            >
                              {analyzing === session.id ? (
                                <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Sparkles className="w-3 h-3" />
                              )}
                              Analyseer verhoortechniek
                            </button>
                          )}
                        </div>
                        {analyzeError[session.id] && (
                          <p className="text-xs text-red-600 mb-1.5">{analyzeError[session.id]}</p>
                        )}
                        {techniqueAnalysis[session.id]?.summary && (
                          <p className="text-xs text-gray-500 italic mb-1.5">{techniqueAnalysis[session.id].summary}</p>
                        )}
                        <div className="bg-white border border-gray-100 rounded-md p-3 max-h-52 overflow-y-auto space-y-2.5">
                          {session.transcript.length === 0 ? (
                            <p className="text-xs text-gray-400">Geen transcript beschikbaar.</p>
                          ) : session.transcript.map((msg, i) => {
                            const label = techniqueAnalysis[session.id]?.labels[i]
                            return (
                              <div key={i} className={`flex gap-2 ${msg.role === 'student' ? '' : 'flex-row-reverse'}`}>
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                                  msg.role === 'student' ? 'bg-ink-100 text-ink-700' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {msg.role === 'student' ? 'A' : 'G'}
                                </div>
                                <div className={`max-w-xs ${msg.role === 'student' ? '' : 'text-right'}`}>
                                  <p className={`text-xs rounded-md px-2.5 py-1.5 ${
                                    msg.role === 'student'
                                      ? 'bg-ink-50 text-ink-900'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {msg.content}
                                  </p>
                                  {label && (
                                    <span className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded border ${TECHNIQUE_LABEL_STYLE[label] ?? 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                                      {label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Submitted PV */}
                      <div className="px-4 pb-4">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Ingediend PV</p>
                        <pre className="bg-white border border-gray-100 rounded-md px-3.5 py-3 text-xs text-gray-700 font-mono whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
                          {report.content}
                        </pre>
                      </div>
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
