import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb, teacherExists } from '@/lib/firebase-admin'

/**
 * Repairs an existing Firebase Auth user that's missing its Firestore
 * profile and/or role custom claim — the state a bootstrap attempt can
 * leave behind if it got partway through (createUser succeeded, then
 * something after it failed) without this being caught/retried.
 *
 * Same shared secret as the other /api/admin/* debug tools. Finds the
 * Auth user by email, sets the role claim, and writes the profile doc —
 * does NOT create a new Auth user (that's what /api/admin/bootstrap is
 * for), only fixes an existing orphaned one.
 *
 *   /api/admin/repair-account?token=...&email=...&name=...&role=teacher
 */

function htmlPage(title: string, bodyHtml: string) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f5f4f0; color: #1b2a38; margin: 0; padding: 2rem 1.25rem; }
  .card { max-width: 420px; margin: 2rem auto; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  h1 { font-size: 1.1rem; margin: 0 0 0.75rem; }
  p { font-size: 0.95rem; line-height: 1.5; color: #44504f; }
  a.button { display: block; text-align: center; background: #98782f; color: white; text-decoration: none; padding: 0.85rem; border-radius: 10px; font-weight: 600; margin-top: 1.25rem; }
  .error { color: #b91c1c; }
  .ok { color: #15803d; }
</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const email = searchParams.get('email')
  const name = searchParams.get('name')
  const role = searchParams.get('role') === 'student' ? 'student' : 'teacher'

  if (!process.env.ADMIN_BOOTSTRAP_SECRET || token !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return new NextResponse(htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">Ongeldig token.</p>'), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  if (await teacherExists()) {
    return new NextResponse(
      htmlPage('Uitgeschakeld', '<h1>Uitgeschakeld</h1><p class="error">Er bestaat al een docentaccount. Dit herstel-endpoint werkt alleen zolang er nog geen docent is. Gebruik /teacher/users of "Wachtwoord vergeten" op /login.</p>'),
      { status: 409, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }
  if (!email || !name) {
    return new NextResponse(htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">E-mail en naam zijn verplicht.</p>'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const auth = adminAuth()
  const db = adminDb()
  if (!auth || !db) {
    return new NextResponse(htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">Firebase Admin niet geconfigureerd.</p>'), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  try {
    const userRecord = await auth.getUserByEmail(email)
    await auth.setCustomUserClaims(userRecord.uid, { role })

    const profileData = {
      uid: userRecord.uid,
      email: userRecord.email,
      name,
      role,
      createdAt: new Date().toISOString(),
    }
    await db.collection('profiles').doc(userRecord.uid).set(profileData)

    return new NextResponse(
      htmlPage('Hersteld', `
        <h1>Account hersteld ✓</h1>
        <p>Profiel aangemaakt voor <strong>${name}</strong> (${userRecord.email}), rol: <strong>${role}</strong>.</p>
        <p class="ok">Je kunt nu inloggen met het wachtwoord dat je al had ingesteld.</p>
      `),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || ''
    const msg = code === 'auth/user-not-found' ? `Geen Auth-account gevonden bij ${email}.` : 'Herstellen mislukt.'
    console.error('repair-account error:', error)
    return new NextResponse(htmlPage('Mislukt', `<h1>Mislukt</h1><p class="error">${msg}</p>`), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}
