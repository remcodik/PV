'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { UserProfile, UserRole } from '@/lib/types'

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
  register: (email: string, password: string, name: string, role: UserRole) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 2000)
    let unsub: (() => void) | undefined
    try {
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeout)
        setUser(firebaseUser)
        if (firebaseUser) {
          setSessionCookie()
          try {
            const docRef = doc(db, 'profiles', firebaseUser.uid)
            const snap = await getDoc(docRef)
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile)
            } else {
              // Profile not in Firestore — check localStorage then sync up
              const local = localStorage.getItem(`profile_${firebaseUser.uid}`)
              let profileData: UserProfile
              if (local) {
                profileData = JSON.parse(local) as UserProfile
              } else {
                profileData = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Student',
                  role: 'student',
                  createdAt: new Date().toISOString(),
                }
                localStorage.setItem(`profile_${firebaseUser.uid}`, JSON.stringify(profileData))
              }
              setProfile(profileData)
              // Sync missing profile to Firestore so teacher user management can find it
              try { await setDoc(doc(db, 'profiles', firebaseUser.uid), profileData) } catch {}
            }
          } catch {
            // Firestore unavailable — use localStorage only
            const local = localStorage.getItem(`profile_${firebaseUser.uid}`)
            if (local) {
              setProfile(JSON.parse(local) as UserProfile)
            } else {
              const fallback: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Student',
                role: 'student',
                createdAt: new Date().toISOString(),
              }
              setProfile(fallback)
            }
          }
        } else {
          clearSessionCookie()
          setProfile(null)
        }
        setLoading(false)
      }, () => {
        // Firebase auth fout — stop met laden
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
    await signInWithEmailAndPassword(auth, email, password)
  }

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const newProfile: UserProfile = {
      uid: cred.user.uid,
      email,
      name,
      role,
      createdAt: new Date().toISOString(),
    }
    localStorage.setItem(`profile_${cred.user.uid}`, JSON.stringify(newProfile))
    try {
      await setDoc(doc(db, 'profiles', cred.user.uid), newProfile)
    } catch {
      // Firestore mislukt — gebruik localStorage fallback
    }
    setProfile(newProfile)
  }

  const logout = async () => {
    await signOut(auth)
    clearSessionCookie()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
