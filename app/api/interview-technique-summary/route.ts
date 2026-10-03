export const maxDuration = 20

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { TranscriptMessage } from '@/lib/types'
import { requireAuth, AuthError, checkAiUsageCap } from '@/lib/firebase-admin'

const client = new Anthropic()

// Student-facing self-reflection, distinct from the teacher's line-by-line
// /api/analyze-interview-technique tool: that one labels every individual
// question for a teacher reviewing a session; this one gives the student
// themselves one short, encouraging paragraph about their own overall
// pattern, right after they've finished an interview. Not graded, not
// shown to the teacher, purely a "here's what you did well and what to
// work on next time" reflection — same question-quality categories
// (open/gesloten/suggestief/samengesteld) as everywhere else, just framed
// for self-improvement rather than review.
const SYSTEM_PROMPT = `Je geeft een politiestudent een korte, persoonlijke reflectie op de eigen verhoortechniek, net na afloop van een interview-oefening.

Je ziet alleen de vragen die de student heeft gesteld (niet de antwoorden, geen zaakgegevens). Beoordeel het patroon: veel open vragen? Vooral gesloten? Samengestelde vragen? Goede opbouw?

Schrijf 2-3 zinnen, in de jij-vorm, opbouwend van toon: noem eerst iets wat goed ging, dan één concreet punt om aan te werken volgende keer. Geen cijfer, geen opsomming -- gewoon platte tekst zoals een collega het zou zeggen na afloop.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    await checkAiUsageCap('interview-technique-summary')
    const { transcript }: { transcript: TranscriptMessage[] } = await req.json()

    const studentQuestions = transcript.filter(m => m.role === 'student').map(m => m.content)
    if (studentQuestions.length === 0) {
      return NextResponse.json({ error: 'Geen vragen in dit interview om te beoordelen.' }, { status: 400 })
    }

    const userMessage = `Vragen van de student tijdens dit interview, in volgorde:\n${studentQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 250,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    if (!summary) {
      return NextResponse.json({ error: 'Samenvatting mislukt, probeer het nog eens.' }, { status: 502 })
    }

    return NextResponse.json({ summary })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Interview technique summary error:', error)
    return NextResponse.json({ error: 'Samenvatting ophalen mislukt' }, { status: 500 })
  }
}
