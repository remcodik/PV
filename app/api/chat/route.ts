import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Case, TranscriptMessage } from '@/lib/types'

const client = new Anthropic()

const COOPERATION_STYLE: Record<number, string> = {
  1: 'Je bent zeer coöperatief. Geef informatie spontaan en gedetailleerd, inclusief hints uit de sleutelpunten zonder dat ernaar gevraagd wordt.',
  2: 'Je bent coöperatief. Beantwoord vragen direct en eerlijk, maar geef alleen hints over sleutelpunten als er gericht naar gevraagd wordt.',
  3: 'Je bent neutraal. Antwoord minimaal en soms vaag. Geef vage hints over sleutelpunten en wacht op doorvragen voordat je details geeft.',
  4: 'Je bent terughoudend. Aarzelt bij vragen en geeft incomplete antwoorden. Hint alleen indirect over sleutelpunten; vereis meerdere gerichte vragen.',
  5: 'Je bent vijandig en oncoöperatief. Weiger sommige vragen en geef tegenstrijdige informatie. Geef sleutelpunten alleen prijs bij zeer specifieke, aanhoudende vragen.',
}

export async function POST(req: NextRequest) {
  try {
    const { message, caseData, transcript }: {
      message: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    const keyDiscoveriesSection = caseData.keyDiscoveries?.length
      ? `\n**Sleutelpunten die de student moet achterhalen (hint hier subtiel naar):**\n${caseData.keyDiscoveries.map((kd, i) => `${i + 1}. Wat te achterhalen: "${kd.description}"\n   Hoe te hinten: ${kd.witnessHint}`).join('\n')}`
      : ''

    const systemPrompt = `Je speelt de rol van getuige in een politieverhoor. Blijf altijd in karakter.

**Identiteit:**
- Naam: ${caseData.witnessName}
- Leeftijd: ${caseData.witnessAge} jaar
- Profiel: ${caseData.witnessProfile}

**Gedragsstijl (niveau ${caseData.cooperationLevel}/5):** ${COOPERATION_STYLE[caseData.cooperationLevel]}

**Wat jij weet over het incident:**
${caseData.witnessKnows.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}
${keyDiscoveriesSection}

**Zaakachtergrond:** ${caseData.backgroundStory}

**Regels:**
- Antwoord ALTIJD in het Nederlands
- Blijf consistent in karakter en kennis — verzin niets buiten wat je weet
- Geef realistische, menselijke antwoorden (niet te formeel)
- Houd antwoorden beknopt: 2-4 zinnen, tenzij de agent doorvraagt
- Spreek de agent aan als "agent" of "u"`

    const messages = transcript.map(msg => ({
      role: msg.role === 'student' ? 'user' as const : 'assistant' as const,
      content: msg.content,
    }))
    messages.push({ role: 'user', content: message })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 512,
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
