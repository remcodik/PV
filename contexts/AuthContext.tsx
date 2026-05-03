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
  const registeringRef = useRef(false)

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000)
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

          // Fetch real profile from Firestore — never create a fallback
          try {
            const snap = await getDoc(doc(db, 'profiles', firebaseUser.uid))
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile)
            } else {
              // Check localStorage (for offline/local sessions)
              const raw = localStorage.getItem(`profile_${firebaseUser.uid}`)
              if (raw) {
                const localProfile = JSON.parse(raw) as UserProfile
                setProfile(localProfile)
                // Sync up to Firestore
                try { await setDoc(doc(db, 'profiles', firebaseUser.uid), localProfile) } catch {}
              } else {
                // No profile at all — leave as null so routing blocks this user
                setProfile(null)
              }
            }
          } catch {
            // Firestore unavailable — check localStorage
            const raw = localStorage.getItem(`profile_${firebaseUser.uid}`)
            if (raw) {
              setProfile(JSON.parse(raw) as UserProfile)
            } else {
              // Can't determine role — leave as null, don't guess
              setProfile(null)
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
    // Step 1: authenticate with Firebase Auth
    const cred = await signInWithEmailAndPassword(auth, email, password)

    // Step 2: verify profile exists in Firestore — no profile = no access
    let snap
    try {
      snap = await getDoc(doc(db, 'profiles', cred.user.uid))
    } catch {
      // Firestore unavailable — check localStorage as fallback
      const raw = localStorage.getItem(`profile_${cred.user.uid}`)
      if (!raw) {
        await signOut(auth)
        throw new Error('NO_PROFILE')
      }
      return
    }

    if (!snap.exists()) {
      // Authenticated in Firebase Auth but no Firestore profile — reject login
      await signOut(auth)
      throw new Error('NO_PROFILE')
    }

    // Step 3: set profile immediately so routing is instant and correct
    setProfile(snap.data() as UserProfile)
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
