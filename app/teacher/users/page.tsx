'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { authFetch } from '@/lib/api-client'
import { UserProfile } from '@/lib/types'
import { Shield, Users, Trash2, UserCog, X, RefreshCw, GraduationCap, BookOpen, Plus, ChevronRight, LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TeacherNav from '@/app/teacher/components/TeacherNav'

interface UserRow extends UserProfile {
  sessionCount: number
  reportCount: number
}

interface Toast {
  id: number
  type: 'success' | 'warning' | 'error'
  title: string
  lines: string[]
}

let toastId = 0

export default function UsersPage() {
  const { profile: myProfile, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  // Client-side guard: redirect non-teachers away immediately. This is
  // defense-in-depth for UX only — the real enforcement is server-side in
  // /api/admin/users* (which reject non-teacher tokens) and Firestore rules.
  useEffect(() => {
    if (!authLoading && myProfile && myProfile.role !== 'teacher') {
      router.replace('/student/dashboard')
    }
  }, [authLoading, myProfile, router])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', email: '', role: 'student' as 'student' | 'teacher' })

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = ++toastId
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000)
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await authFetch('/api/admin/users')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Onbekende fout')

      const rows = (data.profiles as UserRow[]).slice().sort((a, b) => a.name.localeCompare(b.name))
      setUsers(rows)
    } catch (err) {
      console.error('fetchUsers error:', err)
      addToast({ type: 'error', title: 'Laden mislukt', lines: [String(err)] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && myProfile?.role === 'teacher') fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, myProfile?.role])

  const changeRole = async (user: UserRow) => {
    const newRole = user.role === 'teacher' ? 'student' : 'teacher'
    setUpdatingRole(user.uid)
    try {
      const res = await authFetch(`/api/admin/users/${user.uid}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Onbekende fout')

      setUsers(prev => prev.map(u => u.uid === user.uid ? { ...u, role: newRole } : u))
      addToast({
        type: 'success',
        title: '✓ Opgeslagen',
        lines: [`Rol gewijzigd: ${user.role} → ${newRole}`],
      })
    } catch (err) {
      addToast({ type: 'error', title: 'Bijwerken mislukt', lines: [String(err)] })
    } finally {
      setUpdatingRole(null)
    }
  }

  const deleteUser = async (user: UserRow) => {
    setDeleting(user.uid)
    setConfirmDelete(null)

    try {
      const res = await authFetch(`/api/admin/users/${user.uid}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Onbekende fout')

      setUsers(prev => prev.filter(u => u.uid !== user.uid))
      addToast({
        type: (data.warnings ?? []).length > 0 ? 'warning' : 'success',
        title: (data.warnings ?? []).length > 0 ? '⚠ Gedeeltelijk verwijderd' : '✓ Verwijderd',
        lines: [...(data.savedTo ?? []), ...(data.warnings ?? [])],
      })
    } catch (err) {
      addToast({ type: 'error', title: 'Verwijderen mislukt', lines: [String(err)] })
    } finally {
      setDeleting(null)
    }
  }

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const res = await authFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createForm.name, email: createForm.email, role: createForm.role }),
      })
      const data = await res.json()
      if (!res.ok) {
        addToast({ type: 'error', title: 'Aanmaken mislukt', lines: [data.error ?? 'Onbekende fout'] })
        return
      }

      const newUser: UserRow = { ...data.profile, sessionCount: 0, reportCount: 0 }
      setUsers(prev => [...prev, newUser].sort((a, b) => a.name.localeCompare(b.name)))
      setShowCreateModal(false)
      setCreateForm({ name: '', email: '', role: 'student' })
      addToast({
        type: data.emailSent ? 'success' : 'warning',
        title: data.emailSent ? '✓ Gebruiker aangemaakt' : '⚠ Aangemaakt, e-mail niet verstuurd',
        lines: [data.message ?? `${data.profile.name} (${data.profile.role})`],
      })
    } catch (err) {
      addToast({ type: 'error', title: 'Aanmaken mislukt', lines: [String(err)] })
    } finally {
      setCreating(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    router.replace('/login')
  }

  const students = users.filter(u => u.role === 'student')
  const teachers = users.filter(u => u.role === 'teacher')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl border shadow-lg p-4 ${
              t.type === 'success' ? 'bg-emerald-50 border-emerald-200' :
              t.type === 'warning' ? 'bg-amber-50 border-amber-200' :
              'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className={`text-sm font-semibold ${
                  t.type === 'success' ? 'text-emerald-800' :
                  t.type === 'warning' ? 'text-amber-800' : 'text-red-800'
                }`}>{t.title}</p>
                {t.lines.map((l, i) => (
                  <p key={i} className={`text-xs mt-0.5 ${
                    t.type === 'success' ? 'text-emerald-700' :
                    t.type === 'warning' ? 'text-amber-700' : 'text-red-700'
                  }`}>{l}</p>
                ))}
              </div>
              <button
                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Gebruiker verwijderen</h3>
            <p className="text-sm text-gray-500 mb-1">
              Je staat op het punt <strong>{confirmDelete.name}</strong> te verwijderen.
            </p>
            <p className="text-xs text-gray-400 mb-5">
              Dit verwijdert het profiel, alle sessies en PV-rapporten uit Firestore.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Annuleren
              </button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Nieuwe gebruiker aanmaken</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={createUser} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Naam</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Voor- en achternaam"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="naam@example.com"
                  className="w-full border border-gray-200 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-400 -mt-1">
                Er is geen wachtwoord nodig — de gebruiker krijgt een e-mail om er zelf een in te stellen.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Rol</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['student', 'teacher'] as const).map(r => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setCreateForm(f => ({ ...f, role: r }))}
                      className={`py-3 rounded-lg text-sm font-medium border transition-colors ${
                        createForm.role === r
                          ? r === 'teacher'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {r === 'student' ? 'Student' : 'Docent'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 border border-gray-200 text-gray-700 py-3 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-green-600 text-white py-3 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                >
                  {creating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {creating ? 'Aanmaken...' : 'Aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">PV Trainer</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
              title="Vernieuwen"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-green-600 text-white px-3 sm:px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nieuwe gebruiker</span>
            </button>
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
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Totaal</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{users.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Studenten</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{students.length}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 sm:p-5">
            <div className="flex items-center gap-1.5 sm:gap-2.5 mb-2 sm:mb-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-50 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 leading-tight">Docenten</p>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{teachers.length}</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <UserSection
              title="Studenten"
              users={students}
              myUid={myProfile?.uid ?? ''}
              deleting={deleting}
              updatingRole={updatingRole}
              onDelete={setConfirmDelete}
              onChangeRole={changeRole}
            />
            <UserSection
              title="Docenten"
              users={teachers}
              myUid={myProfile?.uid ?? ''}
              deleting={deleting}
              updatingRole={updatingRole}
              onDelete={setConfirmDelete}
              onChangeRole={changeRole}
            />
          </>
        )}
      </div>
    </div>
  )
}

function UserSection({
  title,
  users,
  myUid,
  deleting,
  updatingRole,
  onDelete,
  onChangeRole,
}: {
  title: string
  users: UserRow[]
  myUid: string
  deleting: string | null
  updatingRole: string | null
  onDelete: (u: UserRow) => void
  onChangeRole: (u: UserRow) => void
}) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{title}</p>
        <span className="text-xs font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">{users.length}</span>
      </div>

      {users.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-400">Geen {title.toLowerCase()} gevonden.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          {users.map((user, idx) => (
            <div
              key={user.uid}
              className={`flex items-center gap-3 px-4 py-3.5 ${idx < users.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              {user.role === 'student' ? (
                <Link href={`/teacher/students/${user.uid}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-blue-700">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                      {user.uid === myUid && <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">jij</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-right">
                    <div><p className="text-sm font-semibold text-gray-900">{user.sessionCount}</p><p className="text-xs text-gray-400">sessies</p></div>
                    <div><p className="text-sm font-semibold text-gray-900">{user.reportCount}</p><p className="text-xs text-gray-400">PV's</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </Link>
              ) : (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-green-700">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                      {user.uid === myUid && <span className="text-xs bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium">jij</span>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-right">
                    <div><p className="text-sm font-semibold text-gray-900">{user.sessionCount}</p><p className="text-xs text-gray-400">sessies</p></div>
                    <div><p className="text-sm font-semibold text-gray-900">{user.reportCount}</p><p className="text-xs text-gray-400">PV's</p></div>
                  </div>
                </div>
              )}

              {/* Actions — larger tap targets */}
              {user.uid !== myUid && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onChangeRole(user)}
                    disabled={updatingRole === user.uid}
                    title={`Maak ${user.role === 'teacher' ? 'student' : 'docent'}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors min-w-[44px] justify-center"
                  >
                    {updatingRole === user.uid ? (
                      <div className="w-3.5 h-3.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <UserCog className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">{user.role === 'teacher' ? 'Maak student' : 'Maak docent'}</span>
                  </button>
                  <button
                    onClick={() => onDelete(user)}
                    disabled={deleting === user.uid}
                    title="Verwijderen"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-colors min-w-[44px] justify-center"
                  >
                    {deleting === user.uid
                      ? <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                      : <Trash2 className="w-4 h-4" />
                    }
                    <span className="hidden sm:inline">Verwijderen</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
