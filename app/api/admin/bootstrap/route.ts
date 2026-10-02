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
 * Two ways to call it:
 * - GET with query params — just open a URL, e.g. in Safari on a phone.
 *   No terminal, no JSON body, no copy/paste needed. Returns a small
 *   readable HTML page instead of raw JSON, with a tappable link to set
 *   the password.
 *     /api/admin/bootstrap?token=...&name=...&email=...
 * - POST with a JSON body — for scripting/automation.
 *     curl -X POST .../api/admin/bootstrap -d '{"token":"...","name":"...","email":"..."}'
 */

type BootstrapResult =
  | { ok: true; resetLink: string; name: string; email: string }
  | { ok: false; status: number; error: string }

async function runBootstrap(token: string | null, name: string | null, email: string | null): Promise<BootstrapResult> {
  if (!process.env.ADMIN_BOOTSTRAP_SECRET || token !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return { ok: false, status: 401, error: 'Ongeldig of ontbrekend token.' }
  }
  if (!name || !email) {
    return { ok: false, status: 400, error: 'Naam en e-mail zijn verplicht.' }
  }

  const db = adminDb()
  const auth = adminAuth()
  if (!db || !auth) {
    return { ok: false, status: 500, error: 'Firebase Admin niet geconfigureerd.' }
  }

  const existingTeacher = await db.collection('profiles').where('role', '==', 'teacher').limit(1).get()
  if (!existingTeacher.empty) {
    return {
      ok: false, status: 409,
      error: 'Er bestaat al een docentaccount. Gebruik /teacher/users om meer accounts aan te maken — dit bootstrap-endpoint werkt maar één keer.',
    }
  }

  try {
    const placeholderPassword = crypto.randomUUID() + crypto.randomUUID()
    const userRecord = await auth.createUser({ email, password: placeholderPassword, displayName: name })
    await auth.setCustomUserClaims(userRecord.uid, { role: 'teacher' })

    const profileData = { uid: userRecord.uid, email, name, role: 'teacher' as const, createdAt: new Date().toISOString() }
    await db.collection('profiles').doc(userRecord.uid).set(profileData)

    const resetLink = await auth.generatePasswordResetLink(email)
    return { ok: true, resetLink, name, email }
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || ''
    const msg = code === 'auth/email-already-exists' ? 'Dit e-mailadres is al in gebruik in Firebase Auth.' : 'Aanmaken mislukt.'
    console.error('bootstrap error:', error)
    return { ok: false, status: 500, error: msg }
  }
}

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
</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const result = await runBootstrap(
    searchParams.get('token'),
    searchParams.get('name'),
    searchParams.get('email'),
  )

  if (!result.ok) {
    return new NextResponse(
      htmlPage('Mislukt', `<h1>Aanmaken mislukt</h1><p class="error">${result.error}</p>`),
      { status: result.status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  return new NextResponse(
    htmlPage('Account aangemaakt', `
      <h1>Docentaccount aangemaakt ✓</h1>
      <p>Voor <strong>${result.name}</strong> (${result.email}).</p>
      <p>Tik hieronder om een wachtwoord in te stellen, log daarna in op <strong>/admin</strong>.</p>
      <a class="button" href="${result.resetLink}">Stel wachtwoord in</a>
    `),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

export async function POST(req: NextRequest) {
  const { token, name, email } = await req.json()
  const result = await runBootstrap(token, name, email)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    success: true,
    resetLink: result.resetLink,
    message: 'Eerste docentaccount aangemaakt. Open de resetLink hieronder om een wachtwoord in te stellen, log daarna in op /admin.',
  })
}
