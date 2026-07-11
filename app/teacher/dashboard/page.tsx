'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, PVReport, UserProfile } from '@/lib/types'
import { gradeColor } from '@/lib/utils'
import { Users, FileText, ChevronRight, TrendingUp, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import TeacherNav from '@/app/teacher/components/TeacherNav'
import AppHeader from '@/app/components/ui/AppHeader'
import { StatCard } from '@/app/components/ui/StatCard'
import { Card, SectionLabel, EmptyState } from '@/app/components/ui/Card'
import { Spinner } from '@/app/components/ui/Spinner'

export default function TeacherDashboard() {
  const { profile, logout } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [reports, setReports] = useState<PVReport[]>([])
  const [students, setStudents] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessSnap, repSnap, profSnap] = await Promise.all([
          getDocs(collection(db, 'sessions')),
          getDocs(collection(db, 'pvreports')),
          getDocs(collection(db, 'profiles')),
        ])
        const sortedSessions = sessSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Session)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        setSessions(sortedSessions)
        setReports(repSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PVReport))
        setStudents(
          (profSnap.docs.map(d => d.data() as UserProfile)).filter(p => p.role === 'student')
        )
      } catch (err) {
        console.error('Teacher dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const avgGrade = reports.length > 0
    ? (reports.reduce((s, r) => s + r.cijfer, 0) / reports.length).toFixed(1)
    : null

  const byStudent = students.map(s => {
    const studentSessions = sessions.filter(sess => sess.studentId === s.uid)
    const studentReports = reports.filter(r => r.studentId === s.uid)
    const avg = studentReports.length > 0
      ? studentReports.reduce((acc, r) => acc + r.cijfer, 0) / studentReports.length
      : null
    return { student: s, sessions: studentSessions, reports: studentReports, avgGrade: avg }
  })

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader roleLabel="Docent" userName={profile?.name} onLogout={handleLogout} />
      <TeacherNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard icon={Users} label="Studenten" value={students.length} />
          <StatCard icon={ClipboardList} label="Sessies" value={sessions.length} href="/teacher/sessions" />
          <StatCard icon={FileText} label="PV's" value={reports.length} href="/teacher/pvreports" />
          <StatCard
            icon={TrendingUp}
            label="Gem. cijfer"
            value={avgGrade ?? '—'}
            valueClassName={avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}
          />
        </div>

        {/* Students */}
        <SectionLabel>Studenten</SectionLabel>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
          </div>
        ) : byStudent.length === 0 ? (
          <EmptyState icon={Users} title="Nog geen studenten" description="Studenten verschijnen hier zodra ze zich registreren." />
        ) : (
          <Card className="overflow-hidden">
            {byStudent.map(({ student, sessions: ss, reports: rs, avgGrade: ag }, idx) => (
              <Link
                key={student.uid}
                href={`/teacher/students/${student.uid}`}
                className={`flex items-center justify-between px-5 py-4 hover:bg-ink-50 transition-colors ${
                  idx < byStudent.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-ink-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-ink-700">
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{student.name}</p>
                    <p className="text-xs text-gray-400 truncate">{student.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:gap-5 flex-shrink-0 ml-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{ss.length}</p>
                    <p className="text-xs text-gray-400">sessies</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold text-gray-900 font-mono">{rs.length}</p>
                    <p className="text-xs text-gray-400">PV&apos;s</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold font-mono ${ag ? gradeColor(ag) : 'text-gray-300'}`}>
                      {ag ? ag.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">cijfer</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
