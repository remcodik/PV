import { auth } from './firebase'

/**
 * fetch() wrapper that attaches the current user's Firebase ID token as a
 * Bearer Authorization header. Use this for any call to an API route that
 * requires auth (chat, evaluate, generate-case, tts, admin/users*).
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await auth.currentUser?.getIdToken()
  const headers = new Headers(options.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(url, { ...options, headers })
}
