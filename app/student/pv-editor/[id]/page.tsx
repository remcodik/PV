'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, addDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, Case, TranscriptMessage } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { Shield, FileText, ChevronDown, ChevronUp, Send, Eye, EyeOff, ArrowLeft } from 'lucide-react'

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
  const { profile } = useAuth()
  const router = useRouter()
  const isLocal = id.startsWith('local_')

  const [session, setSession] = useState<Session | null>(null)
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [pvContent, setPvContent] = useState(PV_TEMPLATE)
  const [showTranscript, setShowTranscript] = useState(true)
  const [showGuide, setShowGuide] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sessionRef = useRef<Session | null>(null)

  useEffect(() => { sessionRef.current = session }, [session])

  useEffect(() => {
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
  }, [id, isLocal])

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

  const handleSubmit = async () => {
    if (!session || !caseData || !profile) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/evaluate', {
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

  if (!session || !caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push('/student/dashboard')}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 text-sm truncate">{caseData.title}</h1>
              <p className="text-xs text-gray-500">PV schrijven</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {submitError && <p className="text-xs text-red-500 hidden sm:block">{submitError}</p>}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">{submitting ? 'Beoordelen...' : 'PV indienen'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden max-w-6xl mx-auto w-full px-4 py-6 gap-6">
        {/* Left: Transcript */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          {/* Transcript */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                {session.transcript.map((msg, i) => (
                  <div key={i}>
                    <p className="text-xs font-semibold text-gray-500 mb-0.5">
                      {msg.role === 'student' ? 'Agent' : `Getuige (${caseData.witnessName})`}
                    </p>
                    <p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-2">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Writing guide */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                  <p className="font-semibold text-gray-700 mb-1">Zeven W-vragen (25 pt)</p>
                  <ul className="space-y-0.5 list-disc pl-4">
                    <li>Wie (verdachte/slachtoffer)</li>
                    <li>Wat (wat is er gebeurd)</li>
                    <li>Waar (exacte locatie)</li>
                    <li>Wanneer (datum/tijdstip)</li>
                    <li>Waarmee (middelen)</li>
                    <li>Waarom (motief)</li>
                    <li>Hoe (werkwijze)</li>
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
        <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Proces-Verbaal</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Verwijder de sjabloontekst en schrijf je eigen PV. Gebruik het transcript links als referentie.
            </p>
          </div>
          <textarea
            value={pvContent}
            onChange={e => setPvContent(e.target.value)}
            className="flex-1 p-6 font-mono text-sm text-gray-800 resize-none focus:outline-none leading-relaxed"
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
