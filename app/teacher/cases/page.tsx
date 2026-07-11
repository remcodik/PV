'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Case } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { crimeTypeLabel } from '@/lib/utils'
import { Plus, Edit, Trash2, Eye, EyeOff, Sparkles, Users, BookOpen, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import TeacherNav from '@/app/teacher/components/TeacherNav'
import AppHeader from '@/app/components/ui/AppHeader'
import { Card, SectionLabel, EmptyState } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { PageSpinner } from '@/app/components/ui/Spinner'

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
    <div className="min-h-screen bg-paper">
      <AppHeader
        roleLabel="Docent"
        userName={profile?.name}
        onLogout={handleLogout}
        actions={
          <>
            <Link
              href="/teacher/cases/new?mode=generate"
              className="inline-flex items-center gap-2 border border-white/20 bg-white/5 text-white px-3 sm:px-4 py-2 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              <span className="hidden sm:inline">AI genereren</span>
            </Link>
            <Link
              href="/teacher/cases/new"
              className="inline-flex items-center gap-2 bg-gold-600 hover:bg-gold-700 text-white px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nieuwe case</span>
            </Link>
          </>
        }
      />

      <TeacherNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {syncing && <p className="text-xs text-gray-400 mb-4">Synchroniseren...</p>}
        {savedBanner && (
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 mb-6">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <p className="text-sm font-medium text-emerald-800">Case opgeslagen en toegevoegd aan de lijst.</p>
          </div>
        )}
        {[
          { title: 'Gepubliceerd', items: published, count: published.length },
          { title: 'Concept', items: drafts, count: drafts.length },
        ].map(section => (
          <div key={section.title} className="mb-8">
            <SectionLabel count={section.count}>{section.title}</SectionLabel>

            {section.items.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title="Geen cases"
                description="Er zijn nog geen cases in deze categorie."
                className="p-6"
              />
            ) : (
              <div className="space-y-2">
                {section.items.map(c => (
                  <Card key={c.id} className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <Badge tone="neutral">{crimeTypeLabel(c.crimeType)}</Badge>
                          <span className="text-xs text-gray-400 font-mono">{c.legalArticle}</span>
                          {c.isTemplate && <Badge tone="brand">Sjabloon</Badge>}
                          {c.intervieweeType === 'verdachte' && <Badge tone="danger">Verdachte</Badge>}
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
                              className={`p-2.5 rounded-md transition-colors ${
                                c.status === 'published'
                                  ? 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {c.status === 'published' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <Link
                              href={`/teacher/cases/${c.id}`}
                              className="p-2.5 rounded-md text-ink-700 hover:bg-ink-50 transition-colors"
                              title="Bewerken"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            {!c.isTemplate && (
                              <button
                                onClick={() => deleteCase(c.id)}
                                disabled={deleting === c.id}
                                title="Verwijderen"
                                className="p-2.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
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
                  </Card>
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
    <Suspense fallback={<PageSpinner />}>
      <TeacherCasesInner />
    </Suspense>
  )
}
