import { NextRequest, NextResponse } from 'next/server'
import { getApps, initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'
import { hasAdminCredentials } from '@/lib/firebase-admin'

function getAdminApp() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  const existing = getApps().find(a => a.name === 'admin')
  if (existing) return existing
  if (!clientEmail || !privateKey || !projectId) return null
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) }, 'admin')
}

// PATCH — change role or name
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  try {
    const { role, name } = await req.json()
    const app = getAdminApp()

    if (!app) {
      return NextResponse.json({
        error: 'Firebase Admin niet geconfigureerd',
        hint: 'Voeg FIREBASE_ADMIN_* variabelen toe in Vercel.',
      }, { status: 503 })
    }

    const db = getFirestore(app)
    const updates: Record<string, string> = { updatedAt: new Date().toISOString() }
    if (role) updates.role = role
    if (name) updates.name = name

    await db.collection('profiles').doc(uid).update(updates)

    return NextResponse.json({
      success: true,
      updated: Object.keys(updates).filter(k => k !== 'updatedAt'),
      savedTo: ['Firestore: profiles/' + uid],
      timestamp: updates.updatedAt,
    })
  } catch (error) {
    console.error('PATCH /api/admin/users/[uid] error:', error)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

// DELETE — remove user from Firestore + Firebase Auth (if Admin configured)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const savedTo: string[] = []
  const warnings: string[] = []

  try {
    const app = getAdminApp()

    if (!app) {
      return NextResponse.json({
        error: 'Firebase Admin niet geconfigureerd',
        hint: 'Voeg FIREBASE_ADMIN_* variabelen toe in Vercel om gebruikers te verwijderen.',
      }, { status: 503 })
    }

    const db = getFirestore(app)
    const auth = getAuth(app)

    // 1. Delete Firestore profile
    await db.collection('profiles').doc(uid).delete()
    savedTo.push('Firestore: profiles/' + uid)

    // 2. Delete all sessions
    const sessSnap = await db.collection('sessions').where('studentId', '==', uid).get()
    if (!sessSnap.empty) {
      const batch = db.batch()
      sessSnap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      savedTo.push(`Firestore: ${sessSnap.size} sessie(s) verwijderd`)
    }

    // 3. Delete all PV reports
    const repSnap = await db.collection('pvreports').where('studentId', '==', uid).get()
    if (!repSnap.empty) {
      const batch = db.batch()
      repSnap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      savedTo.push(`Firestore: ${repSnap.size} PV-rapport(en) verwijderd`)
    }

    // 4. Delete Firebase Auth account
    if (hasAdminCredentials()) {
      try {
        await auth.deleteUser(uid)
        savedTo.push('Firebase Auth: account verwijderd')
      } catch (authErr: unknown) {
        const msg = authErr instanceof Error ? authErr.message : String(authErr)
        warnings.push('Firebase Auth-account kon niet worden verwijderd: ' + msg)
      }
    } else {
      warnings.push('Firebase Auth-account niet verwijderd (Admin-sleutels ontbreken)')
    }

    return NextResponse.json({
      success: true,
      savedTo,
      warnings,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('DELETE /api/admin/users/[uid] error:', error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
