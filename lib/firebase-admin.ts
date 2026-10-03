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

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Verifies the Firebase ID token on an incoming request and returns
 * { uid, role }. Role comes from the custom claim set at account
 * creation/update time — falls back to a Firestore profile lookup if the
 * claim isn't present (e.g. accounts created before this claim existed).
 *
 * Throws AuthError(401) if there's no/invalid token, or if Admin
 * credentials aren't configured at all (Admin SDK is mandatory for any
 * route that calls this — there is no unauthenticated fallback).
 */
export async function requireAuth(req: Request): Promise<{ uid: string; role: string }> {
  const auth = adminAuth()
  const db = adminDb()
  if (!auth || !db) {
    throw new AuthError('Server niet correct geconfigureerd (Firebase Admin ontbreekt).', 500)
  }

  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) {
    throw new AuthError('Niet ingelogd.', 401)
  }

  let decoded
  try {
    decoded = await auth.verifyIdToken(token)
  } catch {
    throw new AuthError('Ongeldige of verlopen sessie.', 401)
  }

  let role = decoded.role as string | undefined
  if (!role) {
    const snap = await db.collection('profiles').doc(decoded.uid).get()
    role = snap.exists ? (snap.data()?.role as string | undefined) : undefined
  }
  if (!role) {
    throw new AuthError('Geen profiel gevonden voor dit account.', 403)
  }

  return { uid: decoded.uid, role }
}

/** Same as requireAuth, but also rejects anyone who isn't a teacher. */
export async function requireTeacher(req: Request): Promise<{ uid: string; role: string }> {
  const result = await requireAuth(req)
  if (result.role !== 'teacher') {
    throw new AuthError('Alleen docenten hebben toegang tot deze actie.', 403)
  }
  return result
}

/**
 * Soft daily cap on how many times a given AI-calling endpoint can be
 * hit, app-wide (not per-user) — a basic cost-control backstop, not a
 * precise budget tool. Counts live in Firestore (usage_counters/{date}),
 * incremented via a transaction so concurrent requests don't race past
 * the limit. Call this AFTER requireAuth/requireTeacher, before the
 * actual AI call, in every route that spends Anthropic/OpenAI credits.
 *
 * Configured via DAILY_AI_CALL_LIMIT (per endpoint, per day). Unset or
 * non-numeric means no cap is enforced — opt-in, not a surprise 429 for
 * a deployment that never configured it.
 */
export async function checkAiUsageCap(endpoint: string): Promise<void> {
  const limit = Number(process.env.DAILY_AI_CALL_LIMIT)
  if (!Number.isFinite(limit) || limit <= 0) return // not configured — no cap

  const db = adminDb()
  if (!db) return // can't enforce without Firestore; fail open rather than block everything

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD, UTC
  const ref = db.collection('usage_counters').doc(today)

  const overLimit = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const current = (snap.exists ? snap.data()?.[endpoint] : 0) ?? 0
    if (current >= limit) return true
    tx.set(ref, { [endpoint]: current + 1 }, { merge: true })
    return false
  })

  if (overLimit) {
    throw new AuthError(
      `Het dagelijkse limiet voor deze AI-functie is bereikt. Probeer het morgen opnieuw, of vraag een beheerder het limiet (DAILY_AI_CALL_LIMIT) te verhogen.`,
      429,
    )
  }
}
