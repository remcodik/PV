'use client'

import { useEffect, useState } from 'react'
import {
  collection, getDocs, getDoc, doc, query, where, orderBy, limit, addDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { PVReport, Session, ScoreCategory, SCORE_CATEGORY_LABELS, CalibrationEntry } from '@/lib/types'
import { formatDate } from '@/lib/utils'
import { ArrowLeft, Scale, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import AppHeader from '@/app/components/ui/AppHeader'
import TeacherNav from '@/app/teacher/components/TeacherNav'
import { Card, EmptyState } from '@/app/components/ui/Card'
import { Button } from '@/app/components/ui/Button'
import { Spinner } from '@/app/components/ui/Spinner'

const SCORE_MAX: Record<ScoreCategory, number> = {
  formalia: 15, zeven_w: 25, getuigenverklaring: 20,
  delictsomschrijving: 15, objectiviteit: 10, doorvragen: 15,
}
const CATEGORIES = Object.keys(SCORE_MAX) as ScoreCategory[]

type Step = 'list' | 'scoring' | 'revealed'

export default function CalibrationPage() {
  const { profile } = useAuth()
  const [step, setStep] = useState<Step>('list')
  const [reports, setReports] = useState<PVReport[]>([])
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PVReport | null>(null)
  const [ownScores, setOwnScores] = useState<Record<ScoreCategory, number>>(
    () => Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Record<ScoreCategory, number>
  )
  const [saving, setSaving] = useState(false)
  const [myCalibrations, setMyCalibrations] = useState<CalibrationEntry[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const repSnap = await getDocs(
        query(collection(db, 'pvreports'), orderBy('submittedAt', 'desc'), limit(25))
      )
      const allReports = repSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PVReport)
      setReports(allReports)

      const sessIds = Array.from(new Set(allReports.map(r => r.sessionId)))
      const sessMap: Record<string, Session> = {}
      await Promise.all(sessIds.map(async sid => {
        const snap = await getDoc(doc(db, 'sessions', sid))
        if (snap.exists()) sessMap[sid] = { id: sid, ...snap.data() } as Session
      }))
      setSessions(sessMap)

      if (profile) {
        const calSnap = await getDocs(
          query(collection(db, 'calibrations'), where('teacherId', '==', profile.uid))
        )
        setMyCalibrations(calSnap.docs.map(d => ({ id: d.id, ...d.data() }) as CalibrationEntry))
      }
      setLoading(false)
    }
    fetchData()
  }, [profile])

  const startScoring = (report: PVReport) => {
    setSelected(report)
    setOwnScores(Object.fromEntries(CATEGORIES.map(c => [c, 0])) as Record<ScoreCategory, number>)
    setStep('scoring')
  }

  const submitScores = async () => {
    if (!selected || !profile) return
    setSaving(true)
    try {
      const entries: Omit<CalibrationEntry, 'id'>[] = CATEGORIES.map(cat => ({
        teacherId: profile.uid,
        reportId: selected.id,
        sessionId: selected.sessionId,
        category: cat,
        teacherScore: ownScores[cat],
        aiScore: selected.scoresBreakdown[cat] ?? 0,
        maxScore: SCORE_MAX[cat],
        createdAt: new Date().toISOString(),
      }))
      await Promise.all(entries.map(e => addDoc(collection(db, 'calibrations'), e)))
      setMyCalibrations(prev => [...prev, ...entries.map((e, i) => ({ ...e, id: `tmp-${Date.now()}-${i}` }))])
      setStep('revealed')
    } finally {
      setSaving(false)
    }
  }

  // Aggregate profile: average (teacherScore - aiScore) per category,
  // across every calibration this teacher has ever done — this is what
  // turns one-off comparisons into something a teacher actually learns
  // from over time.
  const profileByCategory = CATEGORIES.map(cat => {
    const entries = myCalibrations.filter(c => c.category === cat)
    if (entries.length === 0) return null
    const avgDelta = entries.reduce((sum, e) => sum + (e.teacherScore - e.aiScore), 0) / entries.length
    return { cat, avgDelta, count: entries.length }
  }).filter((x): x is { cat: ScoreCategory; avgDelta: number; count: number } => x !== null)

  const session = selected ? sessions[selected.sessionId] : null

  if (loading) {
    return (
      <div className="min-h-screen bg-paper-warm flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper-warm">
      <AppHeader roleLabel="Docent" userName={profile?.name} />
      <TeacherNav />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center gap-3 mb-5">
          {step !== 'list' ? (
            <button onClick={() => setStep('list')} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : null}
          <div>
            <h1 className="font-semibold text-gray-900">Kalibratietrainer</h1>
            <p className="text-xs text-gray-500">Beoordeel blind, vergelijk daarna met het AI-cijfer</p>
          </div>
        </div>

        {step === 'list' && (
          <>
            {profileByCategory.length > 0 && (
              <Card className="p-4 mb-5">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Je kalibratieprofiel ({myCalibrations.length / CATEGORIES.length | 0} PV&apos;s beoordeeld)
                </p>
                <div className="space-y-1.5">
                  {profileByCategory.map(({ cat, avgDelta, count }) => (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{SCORE_CATEGORY_LABELS[cat]}</span>
                      <span className={`font-mono text-xs ${
                        Math.abs(avgDelta) < 1 ? 'text-gray-400' : avgDelta > 0 ? 'text-amber-600' : 'text-red-500'
                      }`}>
                        {Math.abs(avgDelta) < 1
                          ? 'in lijn met AI'
                          : `gemiddeld ${Math.abs(avgDelta).toFixed(1)} pt ${avgDelta > 0 ? 'strenger' : 'milder'} dan AI`}
                        <span className="text-gray-300"> · n={count}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {reports.length === 0 ? (
              <EmptyState icon={Scale} title="Nog geen PV's" description="Er zijn nog geen beoordeelde PV's om te kalibreren." />
            ) : (
              <Card className="overflow-hidden">
                {reports.map((r, idx) => (
                  <button
                    key={r.id}
                    onClick={() => startScoring(r)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-amber-50/50 transition-colors ${idx < reports.length - 1 ? 'border-b border-gray-100' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{sessions[r.sessionId]?.caseTitle ?? 'Onbekende case'}</p>
                      <p className="text-xs text-gray-400">{formatDate(r.submittedAt)}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </Card>
            )}
          </>
        )}

        {step === 'scoring' && selected && (
          <div className="space-y-5">
            <Card className="p-4 max-h-64 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                PV — {session?.caseTitle ?? 'Onbekende case'}
              </p>
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">{selected.content}</pre>
            </Card>

            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Jouw score (nog geen AI-cijfer zichtbaar)</p>
              <div className="space-y-3">
                {CATEGORIES.map(cat => (
                  <div key={cat} className="flex items-center justify-between gap-3">
                    <label className="text-sm text-gray-700">{SCORE_CATEGORY_LABELS[cat]}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={SCORE_MAX[cat]}
                        value={ownScores[cat]}
                        onChange={e => setOwnScores(prev => ({ ...prev, [cat]: Math.min(SCORE_MAX[cat], Math.max(0, Number(e.target.value))) }))}
                        className="w-16 border border-gray-200 rounded-md px-2 py-1.5 text-sm text-right font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                      <span className="text-xs text-gray-400">/{SCORE_MAX[cat]}</span>
                    </div>
                  </div>
                ))}
              </div>
              <Button onClick={submitScores} disabled={saving} className="w-full mt-4">
                {saving ? 'Bezig...' : 'Vergelijk met AI-cijfer'}
              </Button>
            </Card>
          </div>
        )}

        {step === 'revealed' && selected && (
          <div className="space-y-5">
            <Card className="p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Vergelijking</p>
              <div className="space-y-2.5">
                {CATEGORIES.map(cat => {
                  const own = ownScores[cat]
                  const ai = selected.scoresBreakdown[cat] ?? 0
                  const delta = own - ai
                  return (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{SCORE_CATEGORY_LABELS[cat]}</span>
                      <span className="font-mono text-xs text-gray-500">
                        jij: {own} · AI: {ai}
                        {delta !== 0 && (
                          <span className={delta > 0 ? 'text-amber-600' : 'text-red-500'}> ({delta > 0 ? '+' : ''}{delta})</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            </Card>
            <Link href={`/teacher/students/${selected.studentId}`}>
              <Button variant="secondary" className="w-full">Bekijk volledige AI-feedback voor dit PV</Button>
            </Link>
            <Button onClick={() => setStep('list')} className="w-full">Volgende PV kalibreren</Button>
          </div>
        )}
      </div>
    </div>
  )
}
