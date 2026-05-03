'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Session, UserProfile } from '@/lib/types'
import { Shield, ArrowLeft, ClipboardList } from 'lucide-react'
import { formatDate, crimeTypeLabel } from '@/lib/utils'
import Link from 'next/link'

export default function AllSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [sessSnap, profSnap] = await Promise.all([
        getDocs(collection(db, 'sessions')),
        getDocs(collection(db, 'profiles')),
      ])
      const profMap: Record<string, UserProfile> = {}
      profSnap.docs.forEach(d => { profMap[d.id] = d.data() as UserProfile })
      setProfiles(profMap)
      setSessions(
        sessSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Session)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      )
      setLoading(false)
    }
    fetchData()
  }, [])

  const statusColor = (s: string) =>
    s === 'evaluated' ? 'bg-emerald-100 text-emerald-700' :
    s === 'submitted' ? 'bg-amber-100 text-amber-700' :
    'bg-gray-100 text-gray-500'

  const statusLabel = (s: string) =>
    s === 'evaluated' ? 'Beoordeeld' : s === 'submitted' ? 'Ingediend' : 'Bezig'

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/teacher/dashboard" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-gray-900">Alle sessies</h1>
            <p className="text-xs text-gray-500">{sessions.length} sessies totaal</p>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <ClipboardList className="w-8 h-8 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nog geen sessies.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {sessions.map((s, idx) => {
              const student = profiles[s.studentId]
              return (
                <Link
                  key={s.id}
                  href={`/teacher/students/${s.studentId}`}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${idx < sessions.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-blue-700">
                      {student?.name?.charAt(0).toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.caseTitle}</p>
                    <p className="text-xs text-gray-400">{student?.name ?? s.studentId} · {formatDate(s.createdAt)}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${statusColor(s.status)}`}>
                    {statusLabel(s.status)}
                  </span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
