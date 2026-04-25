'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { collection, getDocs, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, PVReport, UserProfile } from '@/lib/types'
import { gradeColor } from '@/lib/utils'
import { Shield, Users, BookOpen, LogOut, Plus, FileText, ChevronRight, TrendingUp, ClipboardList, UserCog } from 'lucide-react'
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
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">PV Trainer</h1>
              <p className="text-xs text-gray-500">Docent — {profile?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/teacher/cases"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              <BookOpen className="w-4 h-4" />
              Cases beheren
            </Link>
            <button
              onClick={handleLogout}
              className="p-2.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Uitloggen"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Studenten</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{students.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-indigo-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Sessies</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{sessions.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-emerald-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-500">PV's</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{reports.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-2 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-amber-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-500">Gem. cijfer</p>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold ${avgGrade ? gradeColor(parseFloat(avgGrade)) : 'text-gray-300'}`}>
              {avgGrade ?? '—'}
            </p>
          </div>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <Link
            href="/teacher/cases/new"
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-blue-200 transition-all flex items-center gap-4 group"
          >
            <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Plus className="w-5 h-5 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">Nieuwe case</p>
              <p className="text-xs text-gray-400 mt-0.5">Handmatig of via AI</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
          </Link>
          <Link
            href="/teacher/cases"
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-emerald-200 transition-all flex items-center gap-4 group"
          >
            <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <BookOpen className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">Cases beheren</p>
              <p className="text-xs text-gray-400 mt-0.5">Publiceren, bewerken</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
          </Link>
          <Link
            href="/teacher/users"
            className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-indigo-200 transition-all flex items-center gap-4 group"
          >
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center group-hover:bg-indigo-100 transition-colors">
              <UserCog className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 text-sm">Gebruikers</p>
              <p className="text-xs text-gray-400 mt-0.5">Rollen en accounts</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 ml-auto flex-shrink-0" />
          </Link>
        </div>

        {/* Students */}
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 mt-2">Studenten overzicht</p>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : byStudent.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Users className="w-6 h-6 text-gray-400" />
            </div>
            <p className="font-medium text-gray-700 mb-1">Nog geen studenten</p>
            <p className="text-sm text-gray-400">Studenten verschijnen hier zodra ze zich registreren.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {byStudent.map(({ student, sessions: ss, reports: rs, avgGrade: ag }, idx) => (
              <Link
                key={student.uid}
                href={`/teacher/students/${student.uid}`}
                className={`flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors ${
                  idx < byStudent.length - 1 ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-600">
                      {student.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 text-sm truncate">{student.name}</p>
                    <p className="text-xs text-gray-400 truncate">{student.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-5 flex-shrink-0 ml-4">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{ss.length}</p>
                    <p className="text-xs text-gray-400">sessies</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{rs.length}</p>
                    <p className="text-xs text-gray-400">PV's</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${ag ? gradeColor(ag) : 'text-gray-300'}`}>
                      {ag ? ag.toFixed(1) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">cijfer</p>
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
