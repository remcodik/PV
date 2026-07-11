'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, PVReport } from '@/lib/types'
import { formatDate, statusLabel, gradeColor } from '@/lib/utils'
import { BookOpen, CheckCircle, Plus, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import AttentionNoteBanner from '@/app/student/components/AttentionNoteBanner'
import AppHeader from '@/app/components/ui/AppHeader'
import { StatCard } from '@/app/components/ui/StatCard'
import { SectionLabel, EmptyState } from '@/app/components/ui/Card'
import { LinkButton } from '@/app/components/ui/Button'
import { Spinner } from '@/app/components/ui/Spinner'

export default function StudentDashboard() {
  const { profile, logout } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [reports, setReports] = useState<PVReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    const fetchData = async () => {
      try {
        const [sessSnap, repSnap] = await Promise.all([
          getDocs(query(collection(db, 'sessions'), where('studentId', '==', profile.uid))),
          getDocs(query(collection(db, 'pvreports'), where('studentId', '==', profile.uid))),
        ])
        const sorted = sessSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Session)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setSessions(sorted)
        setReports(repSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PVReport))
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [profile])

  const avgGrade = reports.length > 0
    ? (reports.reduce((s, r) => s + r.cijfer, 0) / reports.length).toFixed(1)
    : null

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const sessionHref = (session: Session) =>
    session.status === 'evaluated' ? `/student/results/${session.id}` :
    session.status === 'writing_pv' ? `/student/pv-editor/${session.id}` :
    `/student/interview/${session.id}`

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader roleLabel="Student" userName={profile?.name} onLogout={handleLogout} />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AttentionNoteBanner profile={profile} />
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard icon={BookOpen} label="Sessies" value={sessions.length} />
          <StatCard
            icon={CheckCircle}
            label="Ingediend"
            value={sessions.filter(s => s.status === 'evaluated' || s.status === 'submitted').length}
          />
          <StatCard
            icon={TrendingUp}
            label="Gem. cijfer"
            value={avgGrade ?? '—'}
            valueClassName={avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}
          />
        </div>

        {/* Action */}
        <div className="mb-6 sm:mb-8">
          <LinkButton href="/student/cases">
            <Plus className="w-4 h-4" />
            Nieuwe oefening starten
          </LinkButton>
        </div>

        {/* Sessions */}
        <SectionLabel>Mijn oefeningen</SectionLabel>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState icon={BookOpen} title="Nog geen oefeningen" description="Start je eerste sessie om hier je voortgang te zien." />
        ) : (
          <div className="space-y-2">
            {sessions.map(session => {
              const report = reports.find(r => r.sessionId === session.id)
              const href = sessionHref(session)
              return (
                <div
                  key={session.id}
                  className="relative bg-white rounded-lg border border-gray-200 shadow-sm p-4 flex items-center justify-between active:bg-ink-50 transition-colors"
                >
                  {/* Invisible overlay link covers entire card — guaranteed tappable on iOS */}
                  <Link href={href} className="absolute inset-0 rounded-lg" aria-label={session.caseTitle} />
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      session.status === 'evaluated' ? 'bg-emerald-500' :
                      session.status === 'submitted' ? 'bg-amber-400' :
                      session.status === 'writing_pv' ? 'bg-ink-700' :
                      'bg-gray-300'
                    }`} />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate text-sm">{session.caseTitle}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(session.createdAt)} · {statusLabel(session.status)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    {report && (
                      <span className={`text-xl font-bold font-mono ${gradeColor(report.cijfer)}`}>
                        {report.cijfer.toFixed(1)}
                      </span>
                    )}
                    <span className="relative bg-ink-800 text-white px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap">
                      {session.status === 'evaluated' ? 'Bekijken' :
                       session.status === 'writing_pv' ? 'PV schrijven' :
                       'Doorgaan'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
