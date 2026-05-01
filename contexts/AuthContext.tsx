'use client'

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react'
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
  // Prevents onAuthStateChanged from overwriting profile during registration
  const registeringRef = useRef(false)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 2000)
    let unsub: (() => void) | undefined
    try {
      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        clearTimeout(timeout)
        setUser(firebaseUser)
        if (firebaseUser) {
          setSessionCookie()

          // During register(), profile is set directly — skip here to avoid race
          if (registeringRef.current) {
            setLoading(false)
            return
          }

          try {
            const snap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile)
            } else {
              // Not in Firestore — try localStorage
              const raw = localStorage.getItem(`profile_${firebaseUser.uid}`)
              if (raw) {
                // Found in localStorage: sync it up to Firestore so user management works
                const localProfile = JSON.parse(raw) as UserProfile
                setProfile(localProfile)
                try { await setDoc(doc(db, 'profiles', firebaseUser.uid), localProfile) } catch {}
              } else {
                // No profile anywhere: create minimal fallback (in memory only, not synced)
                const fallback: UserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Gebruiker',
                  role: 'student',
                  createdAt: new Date().toISOString(),
                }
                setProfile(fallback)
              }
            }
          } catch {
            // Firestore unavailable — use localStorage
            const raw = localStorage.getItem(`profile_${firebaseUser.uid}`)
            if (raw) {
              setProfile(JSON.parse(raw) as UserProfile)
            } else {
              setProfile({
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Gebruiker',
                role: 'student',
                createdAt: new Date().toISOString(),
              })
            }
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
    await signInWithEmailAndPassword(auth, email, password)
  }

  const register = async (email: string, password: string, name: string, role: UserRole) => {
    registeringRef.current = true
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const newProfile: UserProfile = {
        uid: cred.user.uid,
        email,
        name,
        role,
        createdAt: new Date().toISOString(),
      }
      // Write to localStorage and Firestore before setting profile state
      localStorage.setItem(`profile_${cred.user.uid}`, JSON.stringify(newProfile))
      try { await setDoc(doc(db, 'profiles', cred.user.uid), newProfile) } catch {}
      setProfile(newProfile)
    } finally {
      registeringRef.current = false
    }
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
