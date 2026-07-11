'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Case } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { crimeTypeLabel } from '@/lib/utils'
import { Shield, ArrowLeft, Users, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'

const COOP_TONES: Record<number, 'success' | 'brand' | 'neutral' | 'warning' | 'danger'> = {
  1: 'success',
  2: 'brand',
  3: 'neutral',
  4: 'warning',
  5: 'danger',
}

const COOP_LABELS: Record<number, string> = {
  1: 'Zeer coöperatief',
  2: 'Coöperatief',
  3: 'Neutraal',
  4: 'Terughoudend',
  5: 'Niet coöperatief',
}

const now = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: now,
  updatedAt: now,
}))

export default function StudentCasesPage() {
  const { profile, user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>(MEMORY_CASES)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    const sync = async () => {
      try {
        const allSnap = await getDocs(collection(db, 'cases'))
        if (allSnap.empty) {
          await Promise.all(
            BUILTIN_CASES.map(c => addDoc(collection(db, 'cases'), { ...c, createdAt: now, updatedAt: now }))
          )
        }
        const snap = await getDocs(query(collection(db, 'cases'), where('status', '==', 'published')))
        if (!snap.empty) {
          setCases(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Case))
        }
      } catch {
        // keep memory fallback
      }
    }
    sync()
  }, [])

  const startSession = async (c: Case) => {
    if (!user) return
    const uid = profile?.uid || user.uid
    const name = profile?.name || user.email?.split('@')[0] || 'Student'
    setStarting(c.id)
    try {
      let caseId = c.id
      if (c.id.startsWith('builtin_')) {
        try {
          const { id, ...caseData } = c
          const caseRef = await addDoc(collection(db, 'cases'), caseData)
          caseId = caseRef.id
        } catch {
          caseId = c.id
        }
      }

      let sessionId: string
      try {
        const sessionRef = await addDoc(collection(db, 'sessions'), {
          caseId,
          caseTitle: c.title,
          studentId: uid,
          studentName: name,
          status: 'interviewing',
          transcript: [],
          createdAt: new Date().toISOString(),
        })
        sessionId = sessionRef.id
      } catch {
        sessionId = `local_${Date.now()}`
        const sessionData = {
          id: sessionId,
          caseId,
          caseTitle: c.title,
          studentId: uid,
          studentName: name,
          status: 'interviewing',
          transcript: [],
          createdAt: new Date().toISOString(),
        }
        localStorage.setItem(`session_${sessionId}`, JSON.stringify(sessionData))
      }

      router.push(`/student/interview/${sessionId}`)
    } catch {
      setStarting(null)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 bg-ink-900 text-white px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/student/dashboard" className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 rounded-md bg-white/10 border border-white/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold">Cases kiezen</h1>
            <p className="text-xs text-white/55">Selecteer een zaak om te oefenen</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Beschikbare cases</p>

        <div className="space-y-3">
          {cases.map(c => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  {/* Badges */}
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge tone="neutral">{crimeTypeLabel(c.crimeType)}</Badge>
                    <span className="text-xs text-gray-400 font-mono">{c.legalArticle}</span>
                    {c.intervieweeType === 'verdachte' && (
                      <Badge tone="danger">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Verdachte
                      </Badge>
                    )}
                  </div>

                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{c.description}</p>

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Users className="w-3.5 h-3.5 text-gray-400" />
                      {c.witnessName}
                    </div>
                    <Badge tone={COOP_TONES[c.cooperationLevel]}>{COOP_LABELS[c.cooperationLevel]}</Badge>
                  </div>
                </div>

                <Button
                  onClick={() => startSession(c)}
                  disabled={starting === c.id || authLoading || !user}
                  className="w-full sm:w-auto"
                >
                  {authLoading ? 'Laden...' : starting === c.id ? 'Starten...' : 'Start oefening'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
