import { NextResponse } from 'next/server'
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
    // Try Admin Firestore first, fall back to client approach via a direct fetch
    const db = getAdminFirestore()
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase Admin niet geconfigureerd', profiles: [] },
        { status: 503 }
      )
    }

    const snap = await db.collection('profiles').get()
    const profiles = snap.docs.map(d => ({ uid: d.id, ...d.data() }))

    // Enrich with session/report counts
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

    return NextResponse.json({
      profiles: enriched,
      hasAdminAuth: hasAdminCredentials(),
    })
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 })
  }
}
