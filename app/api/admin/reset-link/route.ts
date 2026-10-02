import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

/**
 * Generates a password-reset link for an EXISTING account directly,
 * bypassing email delivery entirely. Same shared secret as
 * /api/admin/bootstrap (ADMIN_BOOTSTRAP_SECRET).
 *
 * Why this exists: the normal way to help someone whose reset email
 * never arrives is "ask a teacher to use /teacher/users" — but that
 * doesn't work for the teacher's OWN account if they can't log in yet,
 * which is exactly the scenario that showed up in practice (the
 * bootstrap-created teacher account's reset email didn't arrive, and
 * there was no other teacher yet to help). This is the escape hatch:
 * secret-gated, not role-gated, so it works even with zero working
 * logins.
 *
 * Deliberately NOT self-disabling like /api/admin/bootstrap (that one
 * only ever creates the first account; this one is a standing recovery
 * tool for any account, used as rarely as it's needed). Keep
 * ADMIN_BOOTSTRAP_SECRET private for that reason.
 *
 *   /api/admin/reset-link?token=...&email=...
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
</style></head>
<body><div class="card">${bodyHtml}</div></body></html>`
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const email = searchParams.get('email')

  if (!process.env.ADMIN_BOOTSTRAP_SECRET || token !== process.env.ADMIN_BOOTSTRAP_SECRET) {
    return new NextResponse(
      htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">Ongeldig of ontbrekend token.</p>'),
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
  if (!email) {
    return new NextResponse(
      htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">E-mailadres ontbreekt.</p>'),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  const auth = adminAuth()
  if (!auth) {
    return new NextResponse(
      htmlPage('Mislukt', '<h1>Mislukt</h1><p class="error">Firebase Admin niet geconfigureerd.</p>'),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  try {
    const resetLink = await auth.generatePasswordResetLink(email)
    return new NextResponse(
      htmlPage('Reset-link', `
        <h1>Reset-link voor ${email}</h1>
        <p>Tik hieronder om een wachtwoord in te stellen voor dit account.</p>
        <a class="button" href="${resetLink}">Stel wachtwoord in</a>
      `),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code || ''
    const msg = code === 'auth/user-not-found'
      ? `Geen account gevonden bij ${email}.`
      : 'Genereren van reset-link mislukt.'
    console.error('reset-link error:', error)
    return new NextResponse(
      htmlPage('Mislukt', `<h1>Mislukt</h1><p class="error">${msg}</p>`),
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
}
