'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Case } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { crimeTypeLabel } from '@/lib/utils'
import { Shield, ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'

const COOP_COLORS: Record<number, string> = {
  1: 'bg-green-100 text-green-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
}

const COOP_LABELS: Record<number, string> = {
  1: 'Zeer coöperatief',
  2: 'Coöperatief',
  3: 'Neutraal',
  4: 'Terughoudend',
  5: 'Niet coöperatief',
}

// Show BUILTIN_CASES from memory immediately — Firestore is synced in background
const now = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: now,
  updatedAt: now,
}))

export default function StudentCasesPage() {
  const { profile } = useAuth()
  const router = useRouter()
  const [cases, setCases] = useState<Case[]>(MEMORY_CASES)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    // Sync with Firestore in background — cases already visible from memory
    const sync = async () => {
      try {
        const allSnap = await getDocs(collection(db, 'cases'))
        if (allSnap.empty) {
          // First time: seed all built-in cases to Firestore
          await Promise.all(
            BUILTIN_CASES.map(c => addDoc(collection(db, 'cases'), { ...c, createdAt: now, updatedAt: now }))
          )
        }
        const snap = await getDocs(query(collection(db, 'cases'), where('status', '==', 'published')))
        if (!snap.empty) {
          setCases(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Case))
        }
      } catch {
        // Firestore unavailable — keep showing memory BUILTIN_CASES (already in state)
      }
    }
    sync()
  }, [])

  const startSession = async (c: Case) => {
    if (!profile) return
    setStarting(c.id)
    try {
      let caseId = c.id
      // If this case came from the memory fallback, persist it to Firestore first
      if (c.id.startsWith('builtin_')) {
        const { id, ...caseData } = c
        const caseRef = await addDoc(collection(db, 'cases'), caseData)
        caseId = caseRef.id
      }
      const sessionRef = await addDoc(collection(db, 'sessions'), {
        caseId,
        caseTitle: c.title,
        studentId: profile.uid,
        studentName: profile.name,
        status: 'interviewing',
        transcript: [],
        createdAt: new Date().toISOString(),
      })
      router.push(`/student/interview/${sessionRef.id}`)
    } catch {
      setStarting(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/student/dashboard" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Cases kiezen</h1>
            <p className="text-xs text-gray-500">Selecteer een zaak om te oefenen</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Beschikbare cases</h2>
        <div className="grid gap-4">
          {cases.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {crimeTypeLabel(c.crimeType)}
                    </span>
                    <span className="text-xs font-medium text-gray-500">{c.legalArticle}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-lg">{c.title}</h3>
                  <p className="text-gray-500 text-sm mt-1">{c.description}</p>
                  <div className="flex items-center gap-3 mt-4">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">Getuige: {c.witnessName}</span>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${COOP_COLORS[c.cooperationLevel]}`}>
                      {COOP_LABELS[c.cooperationLevel]}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => startSession(c)}
                  disabled={starting === c.id}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {starting === c.id ? 'Starten...' : 'Start oefening'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
