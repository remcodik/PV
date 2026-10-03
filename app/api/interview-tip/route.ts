export const maxDuration = 20

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { TranscriptMessage } from '@/lib/types'
import { requireAuth, AuthError, checkAiUsageCap } from '@/lib/firebase-admin'

const client = new Anthropic()

// Deliberately receives ONLY the student's own questions from the
// transcript — never the witness/suspect's answers, never case details
// like keyDiscoveries or witnessKnows. This isn't an oversight: it means
// a tip can structurally never leak a fact the student hasn't uncovered
// yet, because the facts are never in the prompt to begin with. The tip
// is about HOW the student is interviewing, not WHAT to ask to get a
// specific answer.
const SYSTEM_PROMPT = `Je geeft een politiestudent die een verhoor oefent ÉÉN korte, concrete tip over verhoortechniek.

Je ziet alleen de vragen die de student tot nu toe heeft gesteld (niet de antwoorden van de getuige/verdachte, en geen zaakgegevens). Geef dus NOOIT een tip over wat er specifiek gevraagd moet worden inhoudelijk ("vraag naar de kleur van de auto") -- dat zou je sowieso niet kunnen weten, en is ook niet de bedoeling. Geef alleen een tip over TECHNIEK:
- Als de student vooral gesloten vragen stelt: wijs op het gebruik van open vragen (wie/wat/waar/wanneer/hoe/waarom).
- Als een vraag samengesteld was (meerdere vragen ineen): wijs op één vraag tegelijk.
- Als er nog geen vragen zijn gesteld: geef een korte starttip (bijv. begin met een open vraag).
- Als de techniek al goed is: een korte bevestiging mag ook, maar varieer -- niet elke keer hetzelfde.

Geef je antwoord als platte tekst, maximaal 1-2 zinnen, geen opsommingen, geen aanhalingstekens.`

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req)
    await checkAiUsageCap('interview-tip')
    const { transcript }: { transcript: TranscriptMessage[] } = await req.json()

    const studentQuestions = transcript.filter(m => m.role === 'student').map(m => m.content)

    const userMessage = studentQuestions.length === 0
      ? 'De student heeft nog geen vraag gesteld — dit is het begin van het interview.'
      : `Vragen van de student tot nu toe, in volgorde:\n${studentQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const tip = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    if (!tip) {
      return NextResponse.json({ error: 'Geen tip beschikbaar, probeer het nog eens.' }, { status: 502 })
    }

    return NextResponse.json({ tip })
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Interview tip error:', error)
    return NextResponse.json({ error: 'Tip ophalen mislukt' }, { status: 500 })
  }
}
