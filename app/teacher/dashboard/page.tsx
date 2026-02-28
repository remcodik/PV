'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, PVReport, UserProfile } from '@/lib/types'
import { formatDate, statusLabel, gradeColor } from '@/lib/utils'
import { Shield, Users, BookOpen, LogOut, Plus, Settings, ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function TeacherDashboard() {
  const { profile, logout } = useAuth()
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [reports, setReports] = useState<PVReport[]>([])
  const [students, setStudents] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const [sessSnap, repSnap, profSnap] = await Promise.all([
        getDocs(query(collection(db, 'sessions'), orderBy('createdAt', 'desc'))),
        getDocs(collection(db, 'pvreports')),
        getDocs(collection(db, 'profiles')),
      ])
      setSessions(sessSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Session))
      setReports(repSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PVReport))
      setStudents(
        (profSnap.docs.map(d => d.data() as UserProfile)).filter(p => p.role === 'student')
      )
      setLoading(false)
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

  // Group sessions by student
  const byStudent = students.map(s => {
    const studentSessions = sessions.filter(sess => sess.studentId === s.uid)
    const studentReports = reports.filter(r => r.studentId === s.uid)
    const avg = studentReports.length > 0
      ? studentReports.reduce((acc, r) => acc + r.cijfer, 0) / studentReports.length
      : null
    return { student: s, sessions: studentSessions, reports: studentReports, avgGrade: avg }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">PV Trainer — Docent</h1>
              <p className="text-xs text-gray-500">{profile?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/teacher/cases"
              className="flex items-center gap-2 text-sm bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              <BookOpen className="w-4 h-4" />
              Cases beheren
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Studenten</p>
            <p className="text-3xl font-bold text-gray-900">{students.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Sessies totaal</p>
            <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Ingediende PV's</p>
            <p className="text-3xl font-bold text-gray-900">{reports.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Gemiddeld cijfer</p>
            <p className={`text-3xl font-bold ${avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-400'}`}>
              {avgGrade ?? '—'}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Link href="/teacher/cases/new" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all flex items-center gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Nieuwe case aanmaken</p>
              <p className="text-sm text-gray-500">Handmatig of via AI genereren</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
          </Link>
          <Link href="/teacher/cases" className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all flex items-center gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Cases beheren</p>
              <p className="text-sm text-gray-500">Publiceren, bewerken, verwijderen</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 ml-auto" />
          </Link>
        </div>

        {/* Students overview */}
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Studenten overzicht</h2>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Laden...</div>
        ) : byStudent.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Nog geen studenten geregistreerd.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {byStudent.map(({ student, sessions: ss, reports: rs, avgGrade: ag }) => (
              <Link
                key={student.uid}
                href={`/teacher/students/${student.uid}`}
                className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-semibold text-gray-600">
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{student.name}</p>
                    <p className="text-sm text-gray-500">{student.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{ss.length}</p>
                    <p className="text-xs text-gray-400">sessies</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-semibold text-gray-900">{rs.length}</p>
                    <p className="text-xs text-gray-400">PV's</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-semibold ${ag ? gradeColor(ag) : 'text-gray-300'}`}>
                      {ag ? ag.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">gem. cijfer</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
