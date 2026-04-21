import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth, Auth } from 'firebase-admin/auth'
import { getFirestore, Firestore } from 'firebase-admin/firestore'

let _adminApp: App | null = null

function getAdminApp(): App | null {
  if (_adminApp) return _adminApp

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!clientEmail || !privateKey || !projectId) return null

  try {
    const existing = getApps().find(a => a.name === 'admin')
    _adminApp = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin')
    return _adminApp
  } catch {
    return null
  }
}

export function adminAuth(): Auth | null {
  const app = getAdminApp()
  return app ? getAuth(app) : null
}

export function adminDb(): Firestore | null {
  const app = getAdminApp()
  return app ? getFirestore(app) : null
}

export function hasAdminCredentials(): boolean {
  return !!(
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY &&
    (process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID)
  )
}
