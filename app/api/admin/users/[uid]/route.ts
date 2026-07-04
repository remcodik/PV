import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, requireTeacher, AuthError } from '@/lib/firebase-admin'

// PATCH — change role or name. Keeps custom claim in sync with Firestore.
// Teachers only.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  try {
    await requireTeacher(req)

    const { role, name } = await req.json()
    if (role && role !== 'student' && role !== 'teacher') {
      return NextResponse.json({ error: 'Ongeldige rol.' }, { status: 400 })
    }

    const db = adminDb()!
    const auth = adminAuth()!

    const updates: Record<string, string> = { updatedAt: new Date().toISOString() }
    if (role) updates.role = role
    if (name) updates.name = name

    await db.collection('profiles').doc(uid).update(updates)
    if (role) {
      await auth.setCustomUserClaims(uid, { role })
    }

    return NextResponse.json({
      success: true,
      updated: Object.keys(updates).filter(k => k !== 'updatedAt'),
      timestamp: updates.updatedAt,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('PATCH /api/admin/users/[uid] error:', error)
    return NextResponse.json({ error: 'Bijwerken mislukt' }, { status: 500 })
  }
}

// DELETE — remove user from Firestore + Firebase Auth, plus their
// sessions/PV reports. Teachers only.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  const savedTo: string[] = []
  const warnings: string[] = []

  try {
    const caller = await requireTeacher(req)
    if (caller.uid === uid) {
      return NextResponse.json({ error: 'Je kunt je eigen account niet verwijderen.' }, { status: 400 })
    }

    const db = adminDb()!
    const auth = adminAuth()!

    await db.collection('profiles').doc(uid).delete()
    savedTo.push('Firestore: profiles/' + uid)

    const sessSnap = await db.collection('sessions').where('studentId', '==', uid).get()
    if (!sessSnap.empty) {
      const batch = db.batch()
      sessSnap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      savedTo.push(`Firestore: ${sessSnap.size} sessie(s) verwijderd`)
    }

    const repSnap = await db.collection('pvreports').where('studentId', '==', uid).get()
    if (!repSnap.empty) {
      const batch = db.batch()
      repSnap.docs.forEach(d => batch.delete(d.ref))
      await batch.commit()
      savedTo.push(`Firestore: ${repSnap.size} PV-rapport(en) verwijderd`)
    }

    try {
      await auth.deleteUser(uid)
      savedTo.push('Firebase Auth: account verwijderd')
    } catch (authErr: unknown) {
      const msg = authErr instanceof Error ? authErr.message : String(authErr)
      warnings.push('Firebase Auth-account kon niet worden verwijderd: ' + msg)
    }

    return NextResponse.json({ success: true, savedTo, warnings, timestamp: new Date().toISOString() })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('DELETE /api/admin/users/[uid] error:', error)
    return NextResponse.json({ error: 'Verwijderen mislukt' }, { status: 500 })
  }
}
