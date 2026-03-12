import { NextRequest, NextResponse } from 'next/server'
import { Case, TranscriptMessage } from '@/lib/types'

// MOCK MODE: Anthropic API key niet ingesteld
// Verwijder deze mock en uncomment de echte implementatie zodra je een API key hebt

const mockReplies = [
  "Ja, dat klopt. Ik heb het zelf gezien.",
  "Ik weet het niet precies meer, het was een tijdje geleden.",
  "Dat kan ik u vertellen, ja. Het was rond half drie 's middags.",
  "Hij droeg een donkere jas, dat weet ik zeker.",
  "Ik stond op ongeveer vijf meter afstand, dus ik kon het goed zien.",
  "Ja, ik heb zelf de politie gebeld. Ik vond dat ik dat moest doen.",
  "Er waren nog meer mensen in de buurt, maar die leken het niet te zien.",
  "De fiets was rood, een stadsfiets. Dat viel me op.",
]

let replyIndex = 0

export async function POST(req: NextRequest) {
  try {
    const { message, caseData, transcript }: {
      message: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    // Gebruik de zaakgegevens voor een iets realistischere mock
    const reply = transcript.length === 0
      ? `Goedemiddag. Ik ben ${caseData.witnessName}. U wilde mij spreken over het incident?`
      : mockReplies[replyIndex++ % mockReplies.length]

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Er is een fout opgetreden' }, { status: 500 })
  }
}
