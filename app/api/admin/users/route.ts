import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, requireTeacher, AuthError } from '@/lib/firebase-admin'

// GET — list all profiles with session/report counts. Teachers only.
export async function GET(req: NextRequest) {
  try {
    await requireTeacher(req)

    const db = adminDb()!
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

    return NextResponse.json({ profiles: enriched })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: 'Laden mislukt' }, { status: 500 })
  }
}

// POST — admin creates a new account (student or teacher). No password is
// set or seen by the admin: a random unusable placeholder is generated,
// then Firebase sends the person a password-reset email so they set their
// own password on first access. Teachers only.
export async function POST(req: NextRequest) {
  try {
    await requireTeacher(req)

    const { name, email, role } = await req.json()
    if (!name || !email || !role) {
      return NextResponse.json({ error: 'Naam, e-mail en rol zijn verplicht.' }, { status: 400 })
    }
    if (role !== 'student' && role !== 'teacher') {
      return NextResponse.json({ error: 'Ongeldige rol.' }, { status: 400 })
    }

    const auth = adminAuth()!
    const db = adminDb()!

    // Random placeholder password — nobody (including the admin) ever uses
    // this; the account is only usable after the reset-email flow below.
    const placeholderPassword = crypto.randomUUID() + crypto.randomUUID()

    let uid: string
    try {
      const userRecord = await auth.createUser({
        email,
        password: placeholderPassword,
        displayName: name,
      })
      uid = userRecord.uid
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || ''
      const msg =
        code === 'auth/email-already-exists' ? 'Dit e-mailadres is al in gebruik.' :
        code === 'auth/invalid-email' ? 'Ongeldig e-mailadres.' :
        'Aanmaken mislukt.'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // Custom claim carries role for fast/cheap verification (no Firestore
    // read needed on every request) — kept in sync with the Firestore
    // profile document below.
    await auth.setCustomUserClaims(uid, { role })

    const profileData = { uid, email, name, role, createdAt: new Date().toISOString() }
    await db.collection('profiles').doc(uid).set(profileData)

    // Generate the actual reset link via the Admin SDK — this works
    // regardless of whether the email address can actually receive mail
    // (e.g. test accounts with fake addresses), since it doesn't depend on
    // delivery. The admin can copy/share this link through any channel.
    let resetLink: string | null = null
    try {
      resetLink = await auth.generatePasswordResetLink(email)
    } catch (err) {
      console.error('generatePasswordResetLink failed:', err)
    }

    // Also attempt to actually send the email, for real addresses where
    // that's more convenient than the admin manually forwarding a link.
    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
    let emailSent = false
    if (apiKey) {
      try {
        const oobRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }),
          }
        )
        emailSent = oobRes.ok
      } catch {
        // Non-fatal — resetLink above is the reliable fallback
      }
    }

    return NextResponse.json({
      success: true,
      uid,
      profile: profileData,
      emailSent,
      resetLink,
      message: emailSent
        ? `Account aangemaakt. Er is een e-mail naar ${email} gestuurd om een wachtwoord in te stellen. Werkt het e-mailadres niet (bijv. testaccount)? Gebruik dan de link hieronder.`
        : `Account aangemaakt. De wachtwoord-e-mail kon niet worden verstuurd — deel de link hieronder handmatig met de gebruiker.`,
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('POST /api/admin/users error:', error)
    return NextResponse.json({ error: 'Aanmaken mislukt' }, { status: 500 })
  }
}
