'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { authFetch } from '@/lib/api-client'
import { UserProfile } from '@/lib/types'
import { Users, Trash2, UserCog, X, RefreshCw, GraduationCap, BookOpen, Plus, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import TeacherNav from '@/app/teacher/components/TeacherNav'
import AppHeader from '@/app/components/ui/AppHeader'
import { StatCard } from '@/app/components/ui/StatCard'
import { SectionLabel, EmptyState } from '@/app/components/ui/Card'
import { Badge } from '@/app/components/ui/Badge'
import { Button } from '@/app/components/ui/Button'
import { Spinner } from '@/app/components/ui/Spinner'

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
  const [resetLinkInfo, setResetLinkInfo] = useState<{ email: string; link: string; emailSent: boolean } | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
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
      if (data.resetLink) {
        setResetLinkInfo({ email: data.profile.email, link: data.resetLink, emailSent: !!data.emailSent })
        setLinkCopied(false)
      }
      addToast({
        type: data.emailSent ? 'success' : 'warning',
        title: data.emailSent ? '✓ Gebruiker aangemaakt' : '⚠ Aangemaakt — deel de link handmatig',
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
    <div className="min-h-screen bg-paper">
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg border shadow-lg p-4 ${
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
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <div className="w-10 h-10 bg-red-50 rounded-md flex items-center justify-center mb-4">
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
              <Button variant="secondary" onClick={() => setConfirmDelete(null)} className="flex-1" size="sm">
                Annuleren
              </Button>
              <button
                onClick={() => deleteUser(confirmDelete)}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-md text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create user modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-semibold text-gray-900">Nieuwe gebruiker aanmaken</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500/20 focus:border-ink-600 transition-colors"
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
                  className="w-full border border-gray-300 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ink-500/20 focus:border-ink-600 transition-colors"
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
                      className={`py-2.5 rounded-md text-sm font-medium border transition-colors ${
                        createForm.role === r
                          ? 'border-ink-700 bg-ink-100 text-ink-700'
                          : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {r === 'student' ? 'Student' : 'Docent'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Annuleren
                </Button>
                <Button type="submit" disabled={creating} className="flex-1">
                  {creating && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                  {creating ? 'Aanmaken...' : 'Aanmaken'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset link — shown after creating a user, stays until dismissed
          (not a toast) since the admin may need to copy it, e.g. when the
          account's email is a test address that can't actually receive mail. */}
      {resetLinkInfo && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center px-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="font-semibold text-gray-900 mb-1">Wachtwoord instellen</h3>
            <p className="text-sm text-gray-500 mb-4">
              {resetLinkInfo.emailSent
                ? `Er is een e-mail naar ${resetLinkInfo.email} gestuurd. Werkt dat adres niet (bijv. een testaccount)? Deel dan onderstaande link handmatig.`
                : `De e-mail naar ${resetLinkInfo.email} kon niet worden verstuurd. Deel deze link handmatig met de gebruiker.`}
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-xs text-gray-700 break-all mb-4">
              {resetLinkInfo.link}
            </div>
            <div className="flex gap-3">
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(resetLinkInfo.link)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2000)
                }}
                className="flex-1"
                size="sm"
              >
                {linkCopied ? '✓ Gekopieerd' : 'Kopieer link'}
              </Button>
              <Button variant="secondary" onClick={() => setResetLinkInfo(null)} className="flex-1" size="sm">
                Sluiten
              </Button>
            </div>
          </div>
        </div>
      )}

      <AppHeader
        roleLabel="Docent"
        userName={myProfile?.name}
        onLogout={handleLogout}
        actions={
          <>
            <button
              onClick={fetchUsers}
              disabled={loading}
              className="p-2 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Vernieuwen"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-gold-600 hover:bg-gold-700 text-white px-3 sm:px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nieuwe gebruiker</span>
            </button>
          </>
        }
      />

      <TeacherNav />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
          <StatCard icon={Users} label="Totaal" value={users.length} />
          <StatCard icon={GraduationCap} label="Studenten" value={students.length} />
          <StatCard icon={BookOpen} label="Docenten" value={teachers.length} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner />
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
      <SectionLabel count={users.length}>{title}</SectionLabel>

      {users.length === 0 ? (
        <EmptyState icon={Users} title={`Geen ${title.toLowerCase()}`} description={`Geen ${title.toLowerCase()} gevonden.`} className="p-6" />
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          {users.map((user, idx) => (
            <div
              key={user.uid}
              className={`flex items-center gap-3 px-4 py-3.5 ${idx < users.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              {user.role === 'student' ? (
                <Link href={`/teacher/students/${user.uid}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-ink-700">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                      {user.uid === myUid && <Badge tone="brand">jij</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-right">
                    <div><p className="text-sm font-semibold text-gray-900 font-mono">{user.sessionCount}</p><p className="text-xs text-gray-400">sessies</p></div>
                    <div><p className="text-sm font-semibold text-gray-900 font-mono">{user.reportCount}</p><p className="text-xs text-gray-400">PV&apos;s</p></div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </Link>
              ) : (
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-ink-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-ink-700">{user.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900 text-sm truncate">{user.name}</p>
                      {user.uid === myUid && <Badge tone="brand">jij</Badge>}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div className="hidden sm:flex items-center gap-4 flex-shrink-0 text-right">
                    <div><p className="text-sm font-semibold text-gray-900 font-mono">{user.sessionCount}</p><p className="text-xs text-gray-400">sessies</p></div>
                    <div><p className="text-sm font-semibold text-gray-900 font-mono">{user.reportCount}</p><p className="text-xs text-gray-400">PV&apos;s</p></div>
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
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors min-w-[44px] justify-center"
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
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border border-gray-300 text-red-500 hover:bg-red-50 hover:border-red-200 disabled:opacity-50 transition-colors min-w-[44px] justify-center"
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
