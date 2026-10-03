export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { TranscriptMessage } from '@/lib/types'
import { requireTeacher, AuthError, checkAiUsageCap } from '@/lib/firebase-admin'

const client = new Anthropic()

// Teacher-facing, review-time analysis — NOT run live during the
// interview. Labels each student ("agent") question in a transcript with
// what it demonstrates about interview technique, so a teacher reviewing
// a session can see the pattern at a glance instead of judging purely
// "by feel". This is explicitly a learning aid for the teacher, not
// another score — no numbers, just a short technique label per question.
const SYSTEM_PROMPT = `Je analyseert een politieverhoor-transcript op verhoortechniek, voor een docent die de sessie nakijkt.

Beoordeel ALLEEN de berichten van de agent (de student), niet de antwoorden van de getuige/verdachte. Voor elk agent-bericht, geef een kort technisch label:
- "open" — een open vraag (wie, wat, waar, wanneer, hoe, waarom)
- "gesloten" — een gesloten ja/nee-vraag
- "suggestief" — een sturende vraag die het antwoord al impliceert
- "samengesteld" — meerdere vragen ineen
- "neutraal" — geen vraag (bijv. een inleidende mededeling, de cautie geven)

Geef je antwoord UITSLUITEND als geldig JSON, zonder markdown-opmaak:
{
  "labels": ["open", "gesloten", ...],
  "summary": "<één zin: wat valt op in het algemene patroon van de vraagtechniek van de agent?>"
}

Het aantal items in "labels" moet exact gelijk zijn aan het aantal agent-berichten in het transcript, in dezelfde volgorde.`

export async function POST(req: NextRequest) {
  try {
    await requireTeacher(req)
    await checkAiUsageCap('analyze-interview-technique')
    const { transcript }: { transcript: TranscriptMessage[] } = await req.json()

    const studentMessages = transcript.filter(m => m.role === 'student')
    if (studentMessages.length === 0) {
      return NextResponse.json({ error: 'Geen agent-berichten in dit transcript.' }, { status: 400 })
    }

    const transcriptText = studentMessages.map((m, i) => `${i + 1}. ${m.content}`).join('\n')

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Agent-berichten (genummerd):\n${transcriptText}` }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    let result: { labels?: string[]; summary?: string } = {}
    if (jsonMatch) {
      try {
        result = JSON.parse(jsonMatch[0])
      } catch {
        // fall through to error below
      }
    }

    if (!Array.isArray(result.labels) || result.labels.length !== studentMessages.length) {
      return NextResponse.json({ error: 'Analyse mislukt, probeer het nog eens.' }, { status: 502 })
    }

    // Map labels back onto the full transcript's indices (so the client
    // doesn't need to re-derive which index is a student message).
    let labelIdx = 0
    const labeledIndices = transcript.map(m => {
      if (m.role !== 'student') return null
      return result.labels![labelIdx++]
    })

    return NextResponse.json({ labels: labeledIndices, summary: result.summary ?? '' })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Analyze interview technique error:', error)
    return NextResponse.json({ error: 'Analyse mislukt' }, { status: 500 })
  }
}
