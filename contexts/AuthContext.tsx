'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  signInWithEmailAndPassword,
  signOut,
  onIdTokenChanged,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { UserProfile } from '@/lib/types'

const SESSION_COOKIE = 'pv_session'

// Holds the actual Firebase ID token (not just a presence flag), so
// proxy.ts can verify it server-side with the Admin SDK and check the
// role claim before allowing /teacher/* — previously this only checked
// whether *some* cookie existed, which isn't a real security boundary.
function setSessionCookie(idToken: string) {
  // max-age slightly under the token's own ~1h lifetime; onIdTokenChanged
  // below refreshes this automatically while the app stays open, and a
  // fresh token is fetched again on next load otherwise.
  document.cookie = `${SESSION_COOKIE}=${idToken}; path=/; max-age=3000; SameSite=Lax`
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
  resetPassword: (email: string) => Promise<void>
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
      // onIdTokenChanged fires on sign-in, sign-out, AND whenever the SDK
      // silently refreshes the token in the background — onAuthStateChanged
      // only fires on sign-in/sign-out, which would leave the cookie's
      // token stale (and eventually rejected by proxy.ts's verification)
      // after about an hour.
      unsub = onIdTokenChanged(auth, async (firebaseUser) => {
        clearTimeout(timeout)
        setUser(firebaseUser)

        if (firebaseUser) {
          try {
            const idToken = await firebaseUser.getIdToken()
            setSessionCookie(idToken)
          } catch {
            // Token fetch failed — treat as logged out for route-guard
            // purposes rather than leaving a stale/invalid cookie behind.
            clearSessionCookie()
          }
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

    // onIdTokenChanged above also fires on this sign-in and sets the
    // cookie, but set it here too so proxy.ts sees a valid session
    // immediately on the very next navigation, without a race.
    const idToken = await cred.user.getIdToken()
    setSessionCookie(idToken)
    setProfile(snap.data() as UserProfile)
  }

  const logout = async () => {
    await signOut(auth)
    clearSessionCookie()
    setProfile(null)
  }

  // Self-service "forgot password" for existing accounts (distinct from
  // the admin-triggered reset link at account creation — this is for
  // someone who already has a working account but forgot their password).
  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
