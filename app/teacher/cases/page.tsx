'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Case } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { crimeTypeLabel } from '@/lib/utils'
import { Shield, Plus, Edit, Trash2, Eye, EyeOff, Sparkles, Users, BookOpen, CheckCircle, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import TeacherNav from '@/app/teacher/components/TeacherNav'

const COOP_LABELS: Record<number, string> = {
  1: 'Zeer coöp.', 2: 'Coöp.', 3: 'Neutraal', 4: 'Terughoudend', 5: 'Niet coöp.',
}

const seedTime = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: seedTime,
  updatedAt: seedTime,
}))

function TeacherCasesInner() {
  const { profile, logout } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const savedParam = searchParams.get('saved')
  const [cases, setCases] = useState<Case[]>(MEMORY_CASES)
  const [syncing, setSyncing] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)
  const [savedBanner, setSavedBanner] = useState(!!savedParam)

  useEffect(() => {
    if (savedParam) {
      const t = setTimeout(() => setSavedBanner(false), 5000)
      return () => clearTimeout(t)
    }
  }, [savedParam])

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    setSyncing(true)
    try {
      const snap = await getDocs(query(collection(db, 'cases')))
      const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Case)

      if (!existing.some(c => c.isTemplate)) {
        await Promise.all(
          BUILTIN_CASES.map(c => addDoc(collection(db, 'cases'), { ...c, createdAt: seedTime, updatedAt: seedTime }))
        )
        const newSnap = await getDocs(query(collection(db, 'cases')))
        setCases(newSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Case))
      } else {
        setCases(existing)
      }
    } catch {
      // keep MEMORY_CASES
    } finally {
      setSyncing(false)
    }
  }

  const toggleStatus = async (c: Case) => {
    if (c.id.startsWith('builtin_')) return
    setToggling(c.id)
    const newStatus = c.status === 'published' ? 'draft' : 'published'
    await updateDoc(doc(db, 'cases', c.id), { status: newStatus })
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x))
    setToggling(null)
  }

  const deleteCase = async (id: string) => {
    if (id.startsWith('builtin_')) return
    if (!confirm('Weet je zeker dat je deze case wilt verwijderen?')) return
    setDeleting(id)
    await deleteDoc(doc(db, 'cases', id))
    setCases(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  // All teachers see all cases
  const published = cases.filter(c => c.status === 'published')
  const drafts = cases.filter(c => c.status === 'draft')

  return (
    <div className="min-h-screen bg-teacher-paper">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teacher-ink rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">PV Trainer</h1>
              {syncing && <p className="text-xs text-gray-400">Synchroniseren...</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/cases/new?mode=generate"
              className="inline-flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="hidden sm:inline">AI genereren</span>
            </Link>
            <Link
              href="/teacher/cases/new"
              className="inline-flex items-center gap-2 bg-teacher-ink text-white px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teacher-ink-dark transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nieuwe case</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 p-2 sm:px-3 sm:py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title="Uitloggen"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Uitloggen</span>
            </button>
          </div>
        </div>
      </header>

      <TeacherNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {savedBanner && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-800">Case opgeslagen en toegevoegd aan de lijst.</p>
          </div>
        )}
        {[
          { title: 'Gepubliceerd', items: published, count: published.length },
          { title: 'Concept', items: drafts, count: drafts.length },
        ].map(section => (
          <div key={section.title} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{section.title}</p>
              <span className="text-xs font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">{section.count}</span>
            </div>

            {section.items.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                  <BookOpen className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500">Geen cases in deze categorie.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {section.items.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                            {crimeTypeLabel(c.crimeType)}
                          </span>
                          <span className="text-xs text-gray-400 font-mono">{c.legalArticle}</span>
                          {c.isTemplate && (
                            <span className="text-xs font-medium bg-teacher-tint text-teacher-ink px-2 py-0.5 rounded-md">
                              Sjabloon
                            </span>
                          )}
                          {c.intervieweeType === 'verdachte' && (
                            <span className="text-xs font-medium bg-red-50 text-red-600 px-2 py-0.5 rounded-md">
                              Verdachte
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-gray-900 text-sm">{c.title}</h3>
                        <p className="text-sm text-gray-400 mt-0.5 truncate">{c.description}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Users className="w-3 h-3" />
                            {c.witnessName}
                          </span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{COOP_LABELS[c.cooperationLevel]}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {!c.id.startsWith('builtin_') ? (
                          <>
                            <button
                              onClick={() => toggleStatus(c)}
                              disabled={toggling === c.id}
                              title={c.status === 'published' ? 'Verbergen' : 'Publiceren'}
                              className={`p-2.5 rounded-lg transition-colors ${
                                c.status === 'published'
                                  ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {c.status === 'published' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <Link
                              href={`/teacher/cases/${c.id}`}
                              className="p-2.5 rounded-lg text-teacher-ink hover:bg-teacher-tint transition-colors"
                              title="Bewerken"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            {!c.isTemplate && (
                              <button
                                onClick={() => deleteCase(c.id)}
                                disabled={deleting === c.id}
                                title="Verwijderen"
                                className="p-2.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-xs text-amber-500 px-2">Sync...</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function TeacherCasesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Laden...</div>}>
      <TeacherCasesInner />
    </Suspense>
  )
}
