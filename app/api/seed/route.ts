import { NextRequest, NextResponse } from 'next/server'
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { BUILTIN_CASES } from '@/lib/cases'

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

export async function POST(req: NextRequest) {
  // Simple auth check — only allow with secret token
  const { token } = await req.json()
  if (token !== process.env.SEED_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    getAdminApp()
    const db = getFirestore()
    const now = new Date().toISOString()

    // Check if already seeded
    const existing = await db.collection('cases').where('isTemplate', '==', true).get()
    if (!existing.empty) {
      return NextResponse.json({ message: `Al ${existing.size} sjabloon-cases aanwezig.` })
    }

    const batch = db.batch()
    for (const c of BUILTIN_CASES) {
      const ref = db.collection('cases').doc()
      batch.set(ref, { ...c, createdAt: now, updatedAt: now })
    }
    await batch.commit()

    return NextResponse.json({ message: `${BUILTIN_CASES.length} cases aangemaakt!` })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Seed mislukt' }, { status: 500 })
  }
}
