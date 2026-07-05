'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { UserProfile } from '@/lib/types'

const SESSION_COOKIE = 'pv_session'

function setSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=86400; SameSite=Lax`
}

function clearSessionCookie() {
  document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// NOTE: There is no client-side "register" anymore. All accounts (student
// and teacher) are created by an admin via /api/admin/users, which also
// writes the Firestore profile server-side and sets a role custom claim.
// A brand-new Firebase Auth user with no Firestore profile is therefore
// always treated as unauthorized here — never given a fallback profile.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000)
    let unsub: (() => void) | undefined
    try {
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeout)
        setUser(firebaseUser)

        if (firebaseUser) {
          setSessionCookie()
          try {
            const snap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
            setProfile(snap.exists() ? (snap.data() as UserProfile) : null)
          } catch {
            // Firestore unavailable — don't guess a role, leave unauthorized
            setProfile(null)
          }
        } else {
          clearSessionCookie()
          setProfile(null)
        }
        setLoading(false)
      }, () => {
        clearTimeout(timeout)
        setLoading(false)
      })
    } catch {
      clearTimeout(timeout)
      setLoading(false)
    }
    return () => { clearTimeout(timeout); unsub?.() }
  }, [])

  const login = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)

    const snap = await getDoc(doc(db, 'profiles', cred.user.uid))
    if (!snap.exists()) {
      // Authenticated in Firebase Auth but no admin-provisioned profile —
      // reject the login. Don't fall back to any client-side guess.
      await signOut(auth)
      throw new Error('NO_PROFILE')
    }

    setProfile(snap.data() as UserProfile)
  }

  const logout = async () => {
    await signOut(auth)
    clearSessionCookie()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
