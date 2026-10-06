import { adminDb } from '@/lib/firebase-admin'
import { BUILTIN_CASES } from '@/lib/cases'
import type { Case, TranscriptMessage } from '@/lib/types'

export class SessionError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Loads a session that must belong to `uid`, plus its case, server-side.
 * Used by /api/chat and /api/evaluate so neither trusts caseData or
 * transcript sent by the browser.
 */
export async function loadOwnedSession(uid: string, sessionId: string): Promise<{
  session: Record<string, unknown> & { status?: string; transcript: TranscriptMessage[] }
  caseData: Case
}> {
  const db = adminDb()
  if (!db) throw new SessionError('Server niet correct geconfigureerd.', 500)

  const sessSnap = await db.collection('sessions').doc(sessionId).get()
  if (!sessSnap.exists) throw new SessionError('Sessie niet gevonden.', 404)
  const sess = sessSnap.data()!
  if (sess.studentId !== uid) throw new SessionError('Deze sessie is niet van jouw account.', 403)

  const caseId = sess.caseId as string
  let caseData: Case
  if (caseId.startsWith('builtin_')) {
    const builtin = BUILTIN_CASES[Number(caseId.slice('builtin_'.length))]
    if (!builtin) throw new SessionError('Case niet gevonden.', 404)
    caseData = { ...builtin, id: caseId } as Case
  } else {
    const caseSnap = await db.collection('cases').doc(caseId).get()
    if (!caseSnap.exists) throw new SessionError('Case niet gevonden.', 404)
    caseData = { ...caseSnap.data(), id: caseSnap.id } as Case
  }

  return {
    session: { ...sess, transcript: (sess.transcript as TranscriptMessage[]) ?? [] },
    caseData,
  }
}
