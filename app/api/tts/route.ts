export const maxDuration = 30
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'

const VOICE_MAP = {
  man: 'onyx',
  vrouw: 'nova',
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY niet ingesteld' }, { status: 503 })
  }

  try {
    const { text, gender }: { text: string; gender: 'man' | 'vrouw' } = await req.json()
    const voice = VOICE_MAP[gender] ?? 'nova'

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
    console.error('TTS error:', error)
    return NextResponse.json({ error: 'TTS mislukt' }, { status: 500 })
  }
}
