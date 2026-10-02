import { NextRequest, NextResponse } from 'next/server'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

/**
 * Diagnostic tool, same shared secret as /api/admin/bootstrap and
 * /api/admin/reset-link. Given an email, reports:
 * - whether a Firebase Auth user exists for that exact email string
 * - that user's uid and custom claims (role)
 * - whether a matching Firestore profiles/{uid} document exists
 *
 * Built to debug a real case where login succeeded (auth-level) but the
 * app reported "no profile" — this surfaces whether that's because the
 * uid truly has no profile doc, or because two different Auth users
 * exist for what looks like "the same" email (casing variants are NOT
 * normalized to the same account by Firebase Auth).
 *
 *   /api/admin/diagnose-account?token=...&email=...
 */

function htmlPage(title: string, bodyHtml: string) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; background: #f5f4f0; color: #1b2a38; margin: 0; padding: 2rem 1.25rem; }
  .card { max-width: 480px; margin: 2rem auto; background: white; border-radius: 16px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  h1 { font-size: 1.1rem; margin: 0 0 0.75rem; }
  p, dt, dd { font-size: 0.9rem; line-height: 1.5; color: #44504f; }
  dl { margin: 0; }
  dt { font-weight: 600; color: #1b2a38; margin-top: 0.75rem; }
  dd { margin: 0; }
  .error { color: #b91c1c; }
  .ok { color: #15803d; }
</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  if (!process.env.ADMIN_BOOTSTRAP_SECRET || token !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return new NextResponse(htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">Ongeldig token.</p>'), { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  if (!email) {
    return new NextResponse(htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">E-mail ontbreekt.</p>'), { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const auth = adminAuth()
  const db = adminDb()
  if (!auth || !db) {
    return new NextResponse(htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">Firebase Admin niet geconfigureerd.</p>'), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  try {
    const userRecord = await auth.getUserByEmail(email)
    const profileSnap = await db.collection('profiles').doc(userRecord.uid).get()

    return new NextResponse(
      htmlPage('Diagnose', `
        <h1>Diagnose voor ${email}</h1>
        <dl>
          <dt>Firebase Auth UID</dt><dd>${userRecord.uid}</dd>
          <dt>Exacte e-mail in Auth</dt><dd>${userRecord.email}</dd>
          <dt>Custom claim role</dt><dd>${userRecord.customClaims?.role ?? '(geen)'}</dd>
          <dt>Firestore profiel aanwezig</dt><dd class="${profileSnap.exists ? 'ok' : 'error'}">${profileSnap.exists ? 'Ja' : 'Nee — dit is het probleem'}</dd>
          ${profileSnap.exists ? `<dt>Profiel-rol</dt><dd>${profileSnap.data()?.role}</dd>` : ''}
        </dl>
      `),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || ''
    const msg = code === 'auth/user-not-found' ? `Geen Firebase Auth-account gevonden bij exact "${email}".` : 'Diagnose mislukt.'
    console.error('diagnose-account error:', error)
    return new NextResponse(htmlPage('Mislukt', `<h1>Mislukt</h1><p class="error">${msg}</p>`), { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
}
