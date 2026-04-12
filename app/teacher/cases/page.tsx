'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, deleteDoc, doc, updateDoc, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Case } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { crimeTypeLabel, formatDate } from '@/lib/utils'
import { Shield, Plus, Edit, Trash2, Eye, EyeOff, ArrowLeft, Sparkles } from 'lucide-react'
import Link from 'next/link'

const COOP_LABELS: Record<number, string> = {
  1: 'Zeer coöp.', 2: 'Coöp.', 3: 'Neutraal', 4: 'Terughoudend', 5: 'Niet coöp.',
}

export default function TeacherCasesPage() {
  const { profile } = useAuth()
  const [cases, setCases] = useState<Case[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    fetchCases()
  }, [])

  const fetchCases = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'cases')))
      const existing = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Case)

      // Auto-seed built-in template cases if none exist in Firestore yet
      if (!existing.some(c => c.isTemplate)) {
        const now = new Date().toISOString()
        await Promise.all(
          BUILTIN_CASES.map(c => addDoc(collection(db, 'cases'), { ...c, createdAt: now, updatedAt: now }))
        )
        const newSnap = await getDocs(query(collection(db, 'cases')))
        setCases(newSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Case))
      } else {
        setCases(existing)
      }
    } catch (err) {
      console.error('fetchCases error:', err)
      // Firestore unavailable — show built-in cases in memory so teacher can still see them
      const now = new Date().toISOString()
      setCases(BUILTIN_CASES.map((c, i) => ({ ...c, id: `builtin_${i}`, createdAt: now, updatedAt: now })))
    } finally {
      setLoading(false)
    }
  }

  const toggleStatus = async (c: Case) => {
    setToggling(c.id)
    const newStatus = c.status === 'published' ? 'draft' : 'published'
    await updateDoc(doc(db, 'cases', c.id), { status: newStatus })
    setCases(prev => prev.map(x => x.id === c.id ? { ...x, status: newStatus } : x))
    setToggling(null)
  }

  const deleteCase = async (id: string) => {
    if (!confirm('Weet je zeker dat je deze case wilt verwijderen?')) return
    setDeleting(id)
    await deleteDoc(doc(db, 'cases', id))
    setCases(prev => prev.filter(c => c.id !== id))
    setDeleting(null)
  }

  const myCases = cases.filter(c => c.createdBy === profile?.uid || c.isTemplate)
  const published = myCases.filter(c => c.status === 'published')
  const drafts = myCases.filter(c => c.status === 'draft')

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher/dashboard" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-gray-900">Cases beheren</h1>
          </div>
          <div className="flex gap-2">
            <Link
              href="/teacher/cases/new?mode=generate"
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-700"
            >
              <Sparkles className="w-4 h-4" />
              AI genereren
            </Link>
            <Link
              href="/teacher/cases/new"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Handmatig
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : (
          <>
            {[
              { title: 'Gepubliceerd', items: published, color: 'green' },
              { title: 'Concept', items: drafts, color: 'gray' },
            ].map(section => (
              <div key={section.title} className="mb-8">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  {section.title} ({section.items.length})
                </h2>
                {section.items.length === 0 ? (
                  <p className="text-gray-400 text-sm">Geen cases in deze categorie.</p>
                ) : (
                  <div className="space-y-3">
                    {section.items.map(c => (
                      <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                                {crimeTypeLabel(c.crimeType)}
                              </span>
                              <span className="text-xs text-gray-400">{c.legalArticle}</span>
                              {c.isTemplate && (
                                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                                  Sjabloon
                                </span>
                              )}
                            </div>
                            <h3 className="font-semibold text-gray-900">{c.title}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">{c.description}</p>
                            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                              <span>Getuige: {c.witnessName}</span>
                              <span>•</span>
                              <span>Meew.: {COOP_LABELS[c.cooperationLevel]}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleStatus(c)}
                              disabled={toggling === c.id}
                              title={c.status === 'published' ? 'Verberg van studenten' : 'Publiceer voor studenten'}
                              className={`p-2 rounded-lg transition-colors ${
                                c.status === 'published'
                                  ? 'text-green-600 bg-green-50 hover:bg-green-100'
                                  : 'text-gray-400 bg-gray-50 hover:bg-gray-100'
                              }`}
                            >
                              {c.status === 'published' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                            </button>
                            <Link
                              href={`/teacher/cases/${c.id}`}
                              className="p-2 rounded-lg text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            {!c.isTemplate && (
                              <button
                                onClick={() => deleteCase(c.id)}
                                disabled={deleting === c.id}
                                className="p-2 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
