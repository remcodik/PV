import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Case, TranscriptMessage, COOPERATION_DESCRIPTIONS } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { message, caseData, transcript }: {
      message: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    const cooperationDesc = COOPERATION_DESCRIPTIONS[caseData.cooperationLevel]

    const systemPrompt = `Je speelt de rol van getuige ${caseData.witnessName}, ${caseData.witnessAge} jaar oud.

PROFIEL VAN DE GETUIGE:
${caseData.witnessProfile}

WAT JIJ ALS GETUIGE WEET:
${caseData.witnessKnows.map((k, i) => `${i + 1}. ${k}`).join('\n')}

JOUW MEEWERKINGSNIVEAU: ${caseData.cooperationLevel}/5 - ${cooperationDesc}

GEDRAGSRICHTLIJNEN OP BASIS VAN MEEWERKINGSNIVEAU ${caseData.cooperationLevel}:
${caseData.cooperationLevel === 1 ? `
- Geef alle informatie spontaan en volledig
- Voeg uit jezelf relevante details toe
- Help de agent actief
- Wees vriendelijk en open` : ''}
${caseData.cooperationLevel === 2 ? `
- Beantwoord vragen direct en volledig
- Geef geen extra informatie die niet gevraagd is
- Blijf zakelijk en correct` : ''}
${caseData.cooperationLevel === 3 ? `
- Geef minimale antwoorden
- Wees soms vaag: "ik meen", "ik denk", "als ik het goed herinner"
- Wacht op doorvragen voor meer details
- Niet vijandig, wel terughoudend` : ''}
${caseData.cooperationLevel === 4 ? `
- Aarzeel voor antwoorden
- Geef regelmatig incomplete antwoorden
- Gebruik uitdrukkingen als "ik weet het niet zeker", "misschien", "dat weet ik niet meer"
- Wissel soms een detail af (maar maak het niet ongeloofwaardig)
- Stel zelf soms een vraag terug` : ''}
${caseData.cooperationLevel === 5 ? `
- Wees merkbaar niet blij met het interview
- Weiger soms een vraag te beantwoorden ("Dat gaat u niets aan")
- Geef tegenstrijdige informatie
- Wees kort en chagrijnig
- Vraag regelmatig waarom je dit moet vertellen` : ''}

EXTRA REGELS:
- Spreek ALTIJD in het Nederlands
- Antwoord ALLEEN vanuit jouw perspectief als getuige (weet alleen wat hierboven staat)
- Verzin GEEN informatie die niet in de bovenstaande lijst staat
- Als iets niet gevraagd wordt en het meewerkingsniveau is 2 of hoger, geef het dan niet spontaan
- Houd antwoorden realistisch en kort (1-4 zinnen normaal)
- Breek NOOIT uit je rol als getuige

ZAAKCONTEXT (voor jouw achtergrondkennis):
${caseData.backgroundStory}`

    const messages = transcript.map(m => ({
      role: m.role === 'student' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }))

    messages.push({ role: 'user', content: message })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: systemPrompt,
      messages,
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({ reply })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json({ error: 'Er is een fout opgetreden' }, { status: 500 })
  }
}
