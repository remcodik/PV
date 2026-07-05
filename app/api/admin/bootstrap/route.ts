import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

/**
 * Creates the very first teacher account. This is the one place in the
 * app that does NOT require an existing teacher token — everything else
 * (including /api/admin/users) does, which creates a chicken-and-egg
 * problem for a brand new setup with zero accounts.
 *
 * Protected two ways:
 * 1. A shared secret (ADMIN_BOOTSTRAP_SECRET) — same pattern as the
 *    existing /api/seed route.
 * 2. Self-disabling: refuses to run if any teacher profile already
 *    exists, so even if the secret leaks later it can never be used to
 *    mint additional admin accounts. Use /teacher/users for that once
 *    you have one working account.
 *
 * Usage (run once, then never again):
 *   curl -X POST https://your-app.vercel.app/api/admin/bootstrap \
 *     -H "Content-Type: application/json" \
 *     -d '{"token":"...", "name":"...", "email":"..."}'
 *
 * Returns a password-reset link directly in the response (not just via
 * email) since at this point there's no other admin to hand you one.
 */
export async function POST(req: NextRequest) {
  try {
    const { token, name, email } = await req.json()

    if (!process.env.ADMIN_BOOTSTRAP_SECRET || token !== process.env.ADMIN_BOOTSTRAP_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!name || !email) {
      return NextResponse.json({ error: 'Naam en e-mail zijn verplicht.' }, { status: 400 })
    }

    const db = adminDb()
    const auth = adminAuth()
    if (!db || !auth) {
      return NextResponse.json({ error: 'Firebase Admin niet geconfigureerd.' }, { status: 500 })
    }

    const existingTeacher = await db.collection('profiles').where('role', '==', 'teacher').limit(1).get()
    if (!existingTeacher.empty) {
      return NextResponse.json({
        error: 'Er bestaat al een docentaccount. Gebruik /teacher/users om meer accounts aan te maken — dit bootstrap-endpoint werkt maar één keer.',
      }, { status: 409 })
    }

    const placeholderPassword = crypto.randomUUID() + crypto.randomUUID()
    const userRecord = await auth.createUser({ email, password: placeholderPassword, displayName: name })
    await auth.setCustomUserClaims(userRecord.uid, { role: 'teacher' })

    const profileData = { uid: userRecord.uid, email, name, role: 'teacher' as const, createdAt: new Date().toISOString() }
    await db.collection('profiles').doc(userRecord.uid).set(profileData)

    const resetLink = await auth.generatePasswordResetLink(email)

    return NextResponse.json({
      success: true,
      uid: userRecord.uid,
      profile: profileData,
      resetLink,
      message: 'Eerste docentaccount aangemaakt. Open de resetLink hieronder om een wachtwoord in te stellen, log daarna in op /admin.',
    })
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || ''
    const msg = code === 'auth/email-already-exists' ? 'Dit e-mailadres is al in gebruik in Firebase Auth.' : 'Aanmaken mislukt.'
    console.error('POST /api/admin/bootstrap error:', error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
