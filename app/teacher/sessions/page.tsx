'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Session, UserProfile } from '@/lib/types'
import { Shield, ArrowLeft, ClipboardList } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import { Card, EmptyState } from '@/app/components/ui/Card'
import { Badge, type BadgeTone } from '@/app/components/ui/Badge'
import { Spinner } from '@/app/components/ui/Spinner'

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

  const statusTone = (s: string): BadgeTone =>
    s === 'evaluated' ? 'success' : s === 'submitted' ? 'warning' : 'neutral'

  const statusLabel = (s: string) =>
    s === 'evaluated' ? 'Beoordeeld' : s === 'submitted' ? 'Ingediend' : 'Bezig'

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link href="/teacher/dashboard" className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="w-9 h-9 bg-ink-800 rounded-md flex items-center justify-center">
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
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nog geen sessies" description="Sessies verschijnen hier zodra studenten beginnen." />
        ) : (
          <Card className="overflow-hidden">
            {sessions.map((s, idx) => {
              const student = profiles[s.studentId]
              return (
                <Link
                  key={s.id}
                  href={`/teacher/students/${s.studentId}`}
                  className={`flex items-center gap-4 px-5 py-4 hover:bg-ink-50 transition-colors ${idx < sessions.length - 1 ? 'border-b border-gray-100' : ''}`}
                >
                  <div className="w-8 h-8 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-ink-700">
                      {student?.name?.charAt(0).toUpperCase() ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.caseTitle}</p>
                    <p className="text-xs text-gray-400">{student?.name ?? s.studentId} · {formatDate(s.createdAt)}</p>
                  </div>
                  <Badge tone={statusTone(s.status)} className="flex-shrink-0 rounded-full">
                    {statusLabel(s.status)}
                  </Badge>
                </Link>
              )
            })}
          </Card>
        )}
      </div>
    </div>
  )
}
