export const maxDuration = 30
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/firebase-admin'

const VOICE_MAP = {
  man: 'onyx',
  vrouw: 'nova',
}

// Whitelist of voices actually supported by tts-1/tts-1-hd — validated so a
// client can't pass an arbitrary string through to the OpenAI API call.
const VALID_VOICES = new Set(['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'])

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY niet ingesteld' }, { status: 503 })
  }

  try {
    await requireAuth(req)
    const { text, gender, voiceId }: { text: string; gender: 'man' | 'vrouw'; voiceId?: string } = await req.json()
    // Prefer the case's own assigned voice (consistent per witness); fall
    // back to a fixed default per gender for older cases with no voiceId.
    const voice = voiceId && VALID_VOICES.has(voiceId) ? voiceId : (VOICE_MAP[gender] ?? 'nova')

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'tts-1', input: text, voice }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.error?.message || 'OpenAI TTS mislukt')
    }

    const audio = await response.arrayBuffer()
    return new NextResponse(audio, {
      headers: { 'Content-Type': 'audio/mpeg' },
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('TTS error:', error)
    return NextResponse.json({ error: 'TTS mislukt' }, { status: 500 })
  }
}
