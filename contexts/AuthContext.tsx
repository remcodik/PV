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
          try {
            const docRef = doc(db, 'profiles', firebaseUser.uid)
            const snap = await getDoc(docRef)
            if (snap.exists()) {
              setProfile(snap.data() as UserProfile)
            } else {
              const local = localStorage.getItem(`profile_${firebaseUser.uid}`)
              if (local) {
                setProfile(JSON.parse(local) as UserProfile)
              } else {
                // No profile anywhere — create a minimal one from auth data
                const fallback: UserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || '',
                  name: firebaseUser.email?.split('@')[0] || 'Student',
                  role: 'student',
                  createdAt: new Date().toISOString(),
                }
                setProfile(fallback)
              }
            }
          } catch {
            // Firestore failed — try localStorage
            const local = localStorage.getItem(`profile_${firebaseUser.uid}`)
            if (local) {
              setProfile(JSON.parse(local) as UserProfile)
            } else {
              // Last resort: minimal profile from auth data
              const fallback: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.email?.split('@')[0] || 'Student',
                role: 'student',
                createdAt: new Date().toISOString(),
              }
              setProfile(fallback)
            }
          }
        } else {
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
