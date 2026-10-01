export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Case, TranscriptMessage } from '@/lib/types'
import { requireAuth, AuthError } from '@/lib/firebase-admin'

const client = new Anthropic()

// Deliberately NOT a mini-evaluate: no score, no cijfer. This runs while
// the student is still writing, so it needs to be fast, cheap, and focused
// on concrete, actionable gaps — "je hebt dit nog niet genoemd" — rather
// than the full graded rubric feedback /api/evaluate gives after
// submission. Keeping the two clearly distinct avoids a student mistaking
// this for their grade.
const SYSTEM_PROMPT = `Je bent een behulpzame assistent voor politiestudenten die een Proces-Verbaal (PV) aan het schrijven zijn. Je geeft GEEN cijfer en GEEN score — alleen een korte, concrete lijst van wat er nog ontbreekt of verbeterd kan worden, zodat de student dit kan aanvullen vóór ze het PV definitief inleveren.

Richt je op feitelijke hiaten, niet op schrijfstijl: ontbrekende W-vragen, ontbrekende formalia, een delictsbestanddeel dat niet is beschreven, een sleutelpunt uit het verhoor dat niet in het PV terecht is gekomen, de cautie die niet vermeld is bij een verdachtenverhoor, enzovoort.

Geef je antwoord UITSLUITEND als geldig JSON, zonder markdown-opmaak of extra tekst:
{
  "items": [
    { "status": "ontbreekt" | "onvolledig" | "ok", "text": "<korte, concrete constatering, max 1 zin>" }
  ],
  "summary": "<één zin: algemene indruk — is het PV grotendeels compleet, of mist er nog het nodige?>"
}

Geef 4-8 items. Noem ALLEEN concrete, specifieke punten (geen vage tips als "wees duidelijker"). Als iets goed is uitgewerkt, mag dat als "ok" item genoemd worden, maar leg de nadruk op wat nog ontbreekt.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    const { pvContent, caseData, transcript }: {
      pvContent: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    if (!pvContent || pvContent.trim().length < 20) {
      return NextResponse.json({ error: 'Schrijf eerst wat meer voordat je een check aanvraagt.' }, { status: 400 })
    }

    const transcriptText = transcript
      .map(m => `${m.role === 'student' ? 'Agent' : caseData.witnessName}: ${m.content}`)
      .join('\n')

    const keyDiscoveriesText = caseData.keyDiscoveries?.length
      ? `\n## Sleutelpunten die de student moest achterhalen\n${caseData.keyDiscoveries.map((kd, i) => `${i + 1}. ${kd.description}`).join('\n')}`
      : ''

    const isSuspect = caseData.intervieweeType === 'verdachte'
    const cautieNote = isSuspect
      ? '\n## Let op\nDit is een verdachtenverhoor — check of de cautie (art. 29 Sv) vermeld is.'
      : ''

    const userMessage = `## Concept-PV (nog niet ingediend)

${pvContent}

## Zaakgegevens
Zaak: ${caseData.title}
Type: ${isSuspect ? 'Verdachteverhoor' : 'Getuigenverhoor'}
Delict: ${caseData.crimeType} (${caseData.legalArticle})
${keyDiscoveriesText}${cautieNote}

## Interview transcript (ter referentie, niet beoordelen)
${transcriptText}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let result: { items?: { status: string; text: string }[]; summary?: string } = {}
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0])
      } catch {
        // fall through to the error response below
      }
    }

    if (!Array.isArray(result.items) || result.items.length === 0) {
      return NextResponse.json({ error: 'Check mislukt, probeer het nog eens.' }, { status: 502 })
    }

    return NextResponse.json({
      items: result.items,
      summary: typeof result.summary === 'string' ? result.summary : '',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Check-PV API error:', error)
    return NextResponse.json({ error: 'Check mislukt' }, { status: 500 })
  }
}
