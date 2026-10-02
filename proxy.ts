import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'

// Renamed from middleware.ts per the Next.js 16 proxy.ts convention — see
// https://nextjs.org/blog/next-16. This also runs on the Node.js runtime
// now (middleware.ts was Edge-only), which is what makes real
// verification here possible: Edge couldn't run the Admin SDK, so the old
// middleware could only check "does *some* cookie exist", not whether it
// was actually valid or which role it belonged to. That's documented in
// git history as a known gap — this closes it.
//
// This is still a coarse, fast first gate, not the only enforcement layer:
// every API route independently verifies the token again via
// requireAuth/requireTeacher (lib/firebase-admin.ts), and Firestore rules
// enforce the same checks at the database layer. A failure here just
// means a faster redirect instead of a slower 401/403 from the API.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get('pv_session')?.value
  const { pathname } = request.nextUrl
  const isTeacherPath = pathname.startsWith('/teacher')
  const isProtected = pathname.startsWith('/student') || isTeacherPath
  const isAuthPage = pathname === '/login'

  if (!isProtected && !isAuthPage) {
    return NextResponse.next()
  }

  const auth = adminAuth()
  let decoded: { uid: string; role?: string } | null = null
  if (token && auth) {
    try {
      const result = await auth.verifyIdToken(token)
      decoded = { uid: result.uid, role: result.role as string | undefined }
    } catch {
      // Expired/invalid/tampered token — treated as no session below.
      decoded = null
    }
  }

  if (isProtected && !decoded) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (isTeacherPath && decoded && decoded.role !== 'teacher') {
    // Valid session, wrong role — send them to their own dashboard rather
    // than back to /login (they're not logged out, just not a teacher).
    const url = request.nextUrl.clone()
    url.pathname = '/student/dashboard'
    return NextResponse.redirect(url)
  }

  if (isAuthPage && decoded) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/student/:path*', '/teacher/:path*', '/login'],
}
