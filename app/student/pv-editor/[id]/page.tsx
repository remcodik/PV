'use client'

import { useEffect, useRef, useState, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, addDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { authFetch } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { Session, Case } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { Shield, FileText, ChevronDown, ChevronUp, Send, Eye, EyeOff, ArrowLeft, Sparkles, CheckCircle2, AlertCircle, Circle, Star } from 'lucide-react'

// Live heuristic checklist for the 7 W's — NOT an AI check, just a quick
// signal while typing. The first four map cleanly onto a template
// placeholder that either has or hasn't been filled in (a reliable
// yes/no). The last three (waarmee/waarom/hoe) aren't separately
// templated in the free-text body, so they're approximated by keyword
// presence — genuinely fuzzy, which is why the UI labels this an
// "automatische hint" rather than a real check. "Controleer mijn PV"
// (the AI-backed check) remains the actual authority on completeness.
const W_CHECKS: { key: string; label: string; test: (content: string) => boolean }[] = [
  { key: 'wie', label: 'Wie (naam/gegevens ingevuld)', test: c => !c.includes('[naam getuige]') && !c.includes('[geboortedatum]') },
  { key: 'wat', label: 'Wat (gebeurtenis beschreven)', test: c => !c.includes('[Beschrijf hier wat er is gebeurd') },
  { key: 'waar', label: 'Waar (locatie ingevuld)', test: c => !c.includes('[Exacte locatie]') },
  { key: 'wanneer', label: 'Wanneer (datum/tijdstip ingevuld)', test: c => !c.includes('[Datum en tijdstip incident]') },
  { key: 'waarmee', label: 'Waarmee (middel genoemd)', test: c => /\b(met|wapen|voertuig|mes|vuist|hand(en)?)\b/i.test(c) },
  { key: 'waarom', label: 'Waarom (motief genoemd)', test: c => /\b(omdat|reden|motief|vanwege|aanleiding)\b/i.test(c) },
  { key: 'hoe', label: 'Hoe (werkwijze beschreven)', test: c => /\b(waarna|vervolgens|werkwijze|manier)\b/i.test(c) },
]
import AttentionNoteBanner from '@/app/student/components/AttentionNoteBanner'
import { Spinner, PageSpinner } from '@/app/components/ui/Spinner'

const now = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: now,
  updatedAt: now,
}))

const PV_TEMPLATE = `PROCES-VERBAAL

Verbalisant: [Naam en rang/nummer agent]
Datum PV: [Datum van opmaken]

Op grond van artikel 152 jo. 153 Wetboek van Strafvordering, opgemaakt op ambtseed/belofte.

BEVINDINGEN

Datum en tijdstip: [Datum en tijdstip incident]
Locatie: [Exacte locatie]

[Beschrijf hier wat er is gebeurd — de feiten zoals vastgesteld]

GETUIGENVERKLARING

Op [datum], omstreeks [tijdstip] uur, bevroeg ik verbalisant genoemde [naam getuige], geboren [geboortedatum], wonende te [adres].

Getuige verklaarde, zakelijk weergegeven:

"[Verklaring van de getuige — zo letterlijk mogelijk weergeven]"

Aldus door mij, verbalisant, opgemaakt en op ambtseed/belofte gesloten.

DELICTSOMSCHRIJVING

Op grond van bovenstaande bevindingen en verklaring is er sprake van overtreding van [wetsartikel] van het Wetboek van Strafrecht, te weten: [omschrijving delict].

De bestanddelen van dit delict zijn als volgt aanwezig:
- [Bestanddeel 1]
- [Bestanddeel 2]

Opgemaakt te [plaats], op [datum].

[Naam verbalisant]
[Rang / Registratienummer]
[Dienst/Eenheid]`

function loadLocalSession(id: string): Session | null {
  try {
    const raw = localStorage.getItem(`session_${id}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function PVEditorPage() {
  const { id } = useParams<{ id: string }>()
  const { profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const isLocal = id.startsWith('local_')

  const [session, setSession] = useState<Session | null>(null)
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [pvContent, setPvContent] = useState(PV_TEMPLATE)
  const wChecks = useMemo(() => W_CHECKS.map(c => ({ ...c, done: c.test(pvContent) })), [pvContent])
  // Which transcript lines the student has marked as "wil ik gebruiken in
  // mijn PV". Purely a personal drafting aid, not graded — persisted in
  // localStorage (keyed per session) rather than Firestore, since it's
  // throwaway scratch state, not something worth a schema/rules change for.
  const [markedLines, setMarkedLines] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const raw = localStorage.getItem(`marked_${id}`)
      return raw ? new Set(JSON.parse(raw)) : new Set()
    } catch {
      return new Set()
    }
  })
  const toggleMark = (i: number) => {
    setMarkedLines(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      try { localStorage.setItem(`marked_${id}`, JSON.stringify([...next])) } catch { /* best effort */ }
      return next
    })
  }
  const [showTranscript, setShowTranscript] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [accessDenied, setAccessDenied] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [checkResult, setCheckResult] = useState<{ items: { status: string; text: string }[]; summary: string } | null>(null)
  const [techniqueSummary, setTechniqueSummary] = useState<string | null>(null)
  const [techniqueLoading, setTechniqueLoading] = useState(false)
  const [techniqueError, setTechniqueError] = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef<Session | null>(null)

  useEffect(() => { sessionRef.current = session }, [session])

  useEffect(() => {
    if (authLoading) return
    const fetchData = async () => {
      try {
        if (isLocal) {
          const localSess = loadLocalSession(id)
          if (!localSess) return
          setSession(localSess)
          if (localSess.pvContent) setPvContent(localSess.pvContent)
          const memCase = MEMORY_CASES.find(c => c.id === localSess.caseId)
          if (memCase) {
            setCaseData(memCase)
          } else {
            try {
              const caseDoc = await getDoc(doc(db, 'cases', localSess.caseId))
              if (caseDoc.exists()) setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
            } catch {}
          }
          return
        }

        const sessDoc = await getDoc(doc(db, 'sessions', id))
        if (!sessDoc.exists()) return
        const sessData = { id: sessDoc.id, ...sessDoc.data() } as Session
        // Ownership check: a student may only open their own session. This
        // is defense-in-depth — Firestore rules enforce the same
        // restriction server-side regardless of what the client does here.
        if (profile?.role !== 'teacher' && sessData.studentId !== profile?.uid) {
          setAccessDenied(true)
          return
        }
        setSession(sessData)
        if (sessData.pvContent) setPvContent(sessData.pvContent)

        if (sessData.caseId.startsWith('builtin_')) {
          const memCase = MEMORY_CASES.find(c => c.id === sessData.caseId)
          if (memCase) { setCaseData(memCase); return }
        }
        const caseDoc = await getDoc(doc(db, 'cases', sessData.caseId))
        if (caseDoc.exists()) {
          setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
        }
      } catch (err) {
        console.error('fetchData error:', err)
      }
    }
    fetchData()
  }, [id, isLocal, authLoading, profile?.uid, profile?.role])

  // Auto-save pvContent 1.5s after last keystroke
  useEffect(() => {
    if (!session) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => {
      const sess = sessionRef.current
      if (!sess) return
      const updated = { ...sess, pvContent }
      if (isLocal) {
        localStorage.setItem(`session_${id}`, JSON.stringify(updated))
      } else {
        localStorage.setItem(`session_${id}`, JSON.stringify(updated))
        try {
          updateDoc(doc(db, 'sessions', id), { pvContent })
        } catch {}
      }
    }, 1500)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [pvContent, id, isLocal, session])

  const handleCheck = async () => {
    if (!session || !caseData) return
    setChecking(true)
    setCheckError(null)
    try {
      const res = await authFetch('/api/check-pv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pvContent, caseData, transcript: session.transcript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Check mislukt')
      setCheckResult({ items: data.items, summary: data.summary })
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Check mislukt')
    } finally {
      setChecking(false)
    }
  }

  const handleTechniqueSummary = async () => {
    if (!session) return
    setTechniqueLoading(true)
    setTechniqueError(null)
    try {
      const res = await authFetch('/api/interview-technique-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: session.transcript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Samenvatting mislukt')
      setTechniqueSummary(data.summary)
    } catch (err) {
      setTechniqueError(err instanceof Error ? err.message : 'Samenvatting mislukt')
    } finally {
      setTechniqueLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!session || !caseData || !profile) return
    setSubmitting(true)
    try {
      const res = await authFetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pvContent,
          caseData,
          transcript: session.transcript,
        }),
      })
      const evaluation = await res.json()
      if (!res.ok || !evaluation.scores) throw new Error(evaluation.error || 'Evaluatie mislukt')

      const reportData = {
        sessionId: id,
        caseId: session.caseId,
        studentId: profile.uid,
        content: pvContent,
        totalScore: evaluation.totalScore,
        cijfer: evaluation.cijfer,
        scoresBreakdown: evaluation.scores,
        feedback: evaluation.feedback,
        generalFeedback: evaluation.generalFeedback,
        submittedAt: new Date().toISOString(),
        evaluatedAt: new Date().toISOString(),
      }

      if (isLocal) {
        // Save report and updated session to localStorage
        const reportId = `report_${id}`
        localStorage.setItem(`pvreport_${reportId}`, JSON.stringify({ id: reportId, ...reportData }))
        const updated = { ...session, status: 'evaluated' as const }
        localStorage.setItem(`session_${id}`, JSON.stringify(updated))
      } else {
        try {
          // Update existing report if one exists, otherwise create new
          const existing = await getDocs(query(collection(db, 'pvreports'), where('sessionId', '==', id)))
          if (!existing.empty) {
            await updateDoc(doc(db, 'pvreports', existing.docs[0].id), reportData)
          } else {
            await addDoc(collection(db, 'pvreports'), reportData)
          }
          await updateDoc(doc(db, 'sessions', id), { status: 'evaluated' })
        } catch {
          // Firestore failed — save to localStorage as fallback
          const reportId = `report_${id}`
          localStorage.setItem(`pvreport_${reportId}`, JSON.stringify({ id: reportId, ...reportData }))
        }
      }

      router.push(`/student/results/${id}`)
    } catch (err) {
      console.error('handleSubmit error:', err)
      setSubmitError('Beoordelen mislukt — probeer opnieuw.')
    } finally {
      setSubmitting(false)
    }
  }

  if (accessDenied) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-semibold text-gray-900">Geen toegang</p>
        <p className="text-sm text-gray-500 max-w-xs">Deze sessie is niet van jouw account.</p>
        <button onClick={() => router.replace('/student/dashboard')} className="text-sm text-ink-700 hover:underline">
          Terug naar dashboard
        </button>
      </div>
    )
  }

  if (!session || !caseData) {
    return <PageSpinner />
  }

  return (
    <div className="min-h-screen bg-paper flex flex-col">
      {/* AI loading overlay */}
      {submitting && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl px-8 py-6 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
            <Spinner className="w-12 h-12" />
            <div className="text-center">
              <p className="font-semibold text-gray-900">PV wordt beoordeeld...</p>
              <p className="text-sm text-gray-500 mt-1">De AI analyseert je PV. Dit duurt 10-20 seconden.</p>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-10 bg-ink-900 text-white px-4 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push('/student/dashboard')}
              className="text-white/70 hover:text-white transition-colors flex-shrink-0 p-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-md bg-amber-600 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-ink-950" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm truncate">{caseData.title}</h1>
              <p className="text-xs text-white/55">PV schrijven</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {submitError && <p className="text-xs text-red-300 hidden sm:block">{submitError}</p>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 bg-amber-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-amber-700 disabled:opacity-60 transition-colors"
            >
              {submitting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">{submitting ? 'Beoordelen...' : 'PV indienen'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto w-full px-4 pt-4 sm:pt-6">
        <AttentionNoteBanner profile={profile} />
      </div>

      <div className="flex-1 flex flex-col sm:flex-row sm:overflow-hidden max-w-6xl mx-auto w-full px-4 py-4 sm:py-6 gap-4 sm:gap-6">
        {/* Left: Transcript */}
        <div className="sm:w-80 sm:flex-shrink-0 flex flex-col gap-4">
          {/* Transcript */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className="w-full flex items-center justify-between px-4 py-3 font-medium text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                {showTranscript ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                Interview transcript ({session.transcript.length} berichten)
              </span>
              {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showTranscript && (
              <div className="border-t border-gray-100 p-4 max-h-96 overflow-y-auto space-y-3">
                {session.transcript.map((msg, i) => {
                  const marked = markedLines.has(i)
                  return (
                    <div key={i} className="group flex items-start gap-1.5">
                      <button
                        onClick={() => toggleMark(i)}
                        title="Markeer om te gebruiken in je PV"
                        className="flex-shrink-0 mt-4 p-0.5 opacity-40 group-hover:opacity-100 transition-opacity"
                      >
                        <Star className={`w-3.5 h-3.5 ${marked ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-500 mb-0.5">
                          {msg.role === 'student' ? 'Agent' : `Getuige (${caseData.witnessName})`}
                        </p>
                        <p className={`text-xs text-gray-700 rounded-lg p-2 ${marked ? 'bg-amber-50 ring-1 ring-amber-200' : 'bg-gray-50'}`}>
                          {msg.content}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Gemarkeerde fragmenten — snel overzicht, geen scrollen door het
              hele transcript nodig terwijl je verder schrijft */}
          {markedLines.size > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-500" />
                Gemarkeerd om te gebruiken ({markedLines.size})
              </p>
              {[...markedLines].sort((a, b) => a - b).map(i => (
                <p key={i} className="text-xs text-amber-900 leading-relaxed">{session.transcript[i]?.content}</p>
              ))}
            </div>
          )}

          {/* Jouw verhoortechniek — zelfreflectie, los van de PV-inhoud */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={handleTechniqueSummary}
              disabled={techniqueLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 font-medium text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {techniqueLoading ? (
                <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Star className="w-4 h-4" />
              )}
              {techniqueLoading ? 'Bezig...' : 'Hoe was mijn verhoortechniek?'}
            </button>
            {techniqueError && (
              <div className="border-t border-gray-100 px-4 py-3 text-xs text-red-600">{techniqueError}</div>
            )}
            {techniqueSummary && (
              <div className="border-t border-gray-100 px-4 py-3">
                <p className="text-sm text-gray-700 leading-relaxed">{techniqueSummary}</p>
              </div>
            )}
          </div>

          {/* Controleer mijn PV — pre-check, geen cijfer */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={handleCheck}
              disabled={checking || pvContent.trim().length < 20}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 font-medium text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {checking ? (
                <div className="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {checking ? 'Bezig met controleren...' : 'Controleer mijn PV (geen cijfer)'}
            </button>
            {checkError && (
              <div className="border-t border-gray-100 px-4 py-3 text-xs text-red-600">{checkError}</div>
            )}
            {checkResult && (
              <div className="border-t border-gray-100 p-4 space-y-3">
                {checkResult.summary && (
                  <p className="text-xs text-gray-600 italic">{checkResult.summary}</p>
                )}
                <ul className="space-y-2">
                  {checkResult.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      {item.status === 'ok' ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      ) : item.status === 'ontbreekt' ? (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      )}
                      <span className="text-gray-700">{item.text}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-gray-400 pt-1">
                  Dit is een hulpmiddel, geen beoordeling — pas je PV aan en controleer opnieuw zo vaak je wilt.
                </p>
              </div>
            )}
          </div>

          {/* Writing guide */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="w-full flex items-center justify-between px-4 py-3 font-medium text-sm text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Schrijfgids PV
              </span>
              {showGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showGuide && (
              <div className="border-t border-gray-100 p-4 space-y-3 text-xs text-gray-600">
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Formalia (15 pt)</p>
                  <ul className="space-y-0.5 list-disc pl-4">
                    <li>Naam en rang verbalisant</li>
                    <li>Datum + tijdstip incident</li>
                    <li>Locatie (exact)</li>
                    <li>Datum opmaken PV</li>
                    <li>Verwijzing art. 152/153 Sv</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-0.5">Zeven W-vragen (25 pt)</p>
                  <p className="text-[10px] text-gray-400 mb-1">Automatische hint terwijl je typt — geen echte check, gebruik &apos;Controleer mijn PV&apos; daarvoor.</p>
                  <ul className="space-y-1">
                    {wChecks.map(c => (
                      <li key={c.key} className="flex items-center gap-1.5">
                        {c.done ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-3 h-3 text-gray-300 flex-shrink-0" />
                        )}
                        <span className={c.done ? 'text-gray-500' : 'text-gray-600'}>{c.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Getuigenverklaring (20 pt)</p>
                  <ul className="space-y-0.5 list-disc pl-4">
                    <li>Naam + persoonsgegevens getuige</li>
                    <li>Verbatim weergave</li>
                    <li>Volledigheid</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Delictsomschrijving (15 pt)</p>
                  <ul className="space-y-0.5 list-disc pl-4">
                    <li>Juist wetsartikel: {caseData.legalArticle}</li>
                    <li>Correcte kwalificatie</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Objectiviteit (10 pt)</p>
                  <ul className="space-y-0.5 list-disc pl-4">
                    <li>Geen subjectief taalgebruik</li>
                    <li>Geen conclusies trekken</li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-700 mb-1">Doorvragen (15 pt)</p>
                  <ul className="space-y-0.5 list-disc pl-4">
                    <li>Sleutelpunten achterhaald via doorvragen</li>
                    <li>Details verwerkt in PV</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Editor */}
        <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col min-h-[60vh] sm:min-h-0">
          <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Proces-Verbaal</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verwijder de sjabloontekst en schrijf je eigen PV. Gebruik het transcript als referentie.
            </p>
          </div>
          <textarea
            value={pvContent}
            onChange={e => setPvContent(e.target.value)}
            className="flex-1 p-4 sm:p-6 font-mono text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ink-500/20 leading-relaxed"
            spellCheck={false}
          />
          <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
            <span>{pvContent.length} tekens · {pvContent.split('\n').length} regels</span>
            <span className="text-green-500">✓ Automatisch opgeslagen</span>
          </div>
        </div>
      </div>
    </div>
  )
}
