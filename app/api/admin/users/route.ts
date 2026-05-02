import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { hasAdminCredentials, adminAuth } from '@/lib/firebase-admin'
import { cert } from 'firebase-admin/app'

function getAdminFirestore() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  let app
  const existing = getApps().find(a => a.name === 'admin')
  if (existing) {
    app = existing
  } else if (clientEmail && privateKey && projectId) {
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin')
  } else {
    return null
  }
  return getFirestore(app)
}

export async function GET() {
  try {
    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin niet geconfigureerd', profiles: [] },
        { status: 503 }
      )
    }

    const snap = await db.collection('profiles').get()
    const profiles = snap.docs.map(d => ({ uid: d.id, ...d.data() }))

    const [sessSnap, repSnap] = await Promise.all([
      db.collection('sessions').get(),
      db.collection('pvreports').get(),
    ])

    const sessionsByStudent: Record<string, number> = {}
    const reportsByStudent: Record<string, number> = {}
    sessSnap.docs.forEach(d => {
      const uid = d.data().studentId
      if (uid) sessionsByStudent[uid] = (sessionsByStudent[uid] ?? 0) + 1
    })
    repSnap.docs.forEach(d => {
      const uid = d.data().studentId
      if (uid) reportsByStudent[uid] = (reportsByStudent[uid] ?? 0) + 1
    })

    const enriched = profiles.map((p: Record<string, unknown>) => ({
      ...p,
      sessionCount: sessionsByStudent[p.uid as string] ?? 0,
      reportCount: reportsByStudent[p.uid as string] ?? 0,
    }))

    return NextResponse.json({ profiles: enriched, hasAdminAuth: hasAdminCredentials() })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 })
  }
}

// POST — create a new user (Firebase Auth REST API + Firestore)
export async function POST(req: NextRequest) {
  try {
    const { name, email, password, role } = await req.json()
    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: 'Naam, e-mail, wachtwoord en rol zijn verplicht.' }, { status: 400 })
    }

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Firebase API key ontbreekt.' }, { status: 500 })
    }

    // Step 1: Create Firebase Auth account via REST API (works without admin credentials)
    const signUpRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName: name, returnSecureToken: true }),
      }
    )
    const signUpData = await signUpRes.json()
    if (!signUpRes.ok) {
      const code = signUpData.error?.message || ''
      const msg =
        code === 'EMAIL_EXISTS' ? 'Dit e-mailadres is al in gebruik.' :
        code === 'WEAK_PASSWORD : Password should be at least 6 characters' ? 'Wachtwoord moet minimaal 6 tekens zijn.' :
        code.includes('WEAK_PASSWORD') ? 'Wachtwoord te zwak (minimaal 6 tekens).' :
        code === 'INVALID_EMAIL' ? 'Ongeldig e-mailadres.' :
        `Aanmaken mislukt: ${code}`
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const uid: string = signUpData.localId
    const idToken: string = signUpData.idToken
    const profileData = { uid, email, name, role, createdAt: new Date().toISOString() }

    // Step 2: Write Firestore profile — Admin SDK if available, else REST API with user's own token
    const adminDb = getAdminFirestore()
    if (adminDb) {
      await adminDb.collection('profiles').doc(uid).set(profileData)
    } else {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      const fsRes = await fetch(
        `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/profiles/${uid}`,
        {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${idToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              uid: { stringValue: uid },
              email: { stringValue: email },
              name: { stringValue: name },
              role: { stringValue: role },
              createdAt: { stringValue: profileData.createdAt },
            },
          }),
        }
      )
      if (!fsRes.ok) {
        const fsErr = await fsRes.json().catch(() => ({}))
        console.error('Firestore REST write failed:', fsErr)
        // Auth account was created — return uid so caller can still show partial success
        return NextResponse.json({
          success: false,
          uid,
          profile: profileData,
          error: 'Account aangemaakt in Firebase Auth, maar profiel kon niet worden opgeslagen in Firestore. Configureer Firebase Admin-sleutels in Vercel.',
          savedTo: ['Firebase Auth: account aangemaakt'],
        }, { status: 207 })
      }
    }

    return NextResponse.json({
      success: true,
      uid,
      profile: profileData,
      savedTo: ['Firebase Auth: account aangemaakt', `Firestore: profiles/${uid}`],
    })
  } catch (error) {
    console.error('POST /api/admin/users error:', error)
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })
  }
}

