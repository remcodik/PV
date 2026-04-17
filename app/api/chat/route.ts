export const maxDuration = 30

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Case, TranscriptMessage } from '@/lib/types'

const client = new Anthropic()

const WITNESS_STYLE: Record<number, string> = {
  1: 'Je bent zeer coöperatief. Geef informatie spontaan en gedetailleerd, inclusief hints uit de sleutelpunten zonder dat ernaar gevraagd wordt.',
  2: 'Je bent coöperatief. Beantwoord vragen direct en eerlijk, maar geef alleen hints over sleutelpunten als er gericht naar gevraagd wordt.',
  3: 'Je bent neutraal. Antwoord minimaal en soms vaag. Geef vage hints over sleutelpunten en wacht op doorvragen voordat je details geeft.',
  4: 'Je bent terughoudend. Aarzelt bij vragen en geeft incomplete antwoorden. Hint alleen indirect over sleutelpunten; vereis meerdere gerichte vragen.',
  5: 'Je bent vijandig en oncoöperatief. Weiger sommige vragen en geef tegenstrijdige informatie. Geef sleutelpunten alleen prijs bij zeer specifieke, aanhoudende vragen.',
}

const SUSPECT_STYLE: Record<number, string> = {
  1: 'Je bekent het delict volledig. Je werkt mee, geeft toe wat je hebt gedaan en beantwoordt vragen eerlijk. Je bent opgelucht dat je het kwijt kunt.',
  2: 'Je geeft toe aan een deel van de feiten maar minimaliseert of verdraait andere delen. Je zegt bijv. dat je "er alleen bij was" of "het per ongeluk deed".',
  3: 'Je ontkent het delict maar geeft toe dat je aanwezig was. Je geeft vage antwoorden en probeert de schuld op anderen te schuiven.',
  4: 'Je ontkent bijna alles. Je geeft alleen toe wat overduidelijk bewijsbaar is. Je bent defensief, antwoordt kort en vraagt regelmatig "heeft u daar bewijs voor?"',
  5: 'Je zwijgt of ontkent alles categorisch. Je zegt herhaaldelijk "geen commentaar" of "ik wens geen verklaring af te leggen". Reageert alleen op directe beschuldigingen met ontkenning.',
}

export async function POST(req: NextRequest) {
  try {
    const { message, caseData, transcript }: {
      message: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    const isSuspect = caseData.intervieweeType === 'verdachte'
    const keyDiscoveriesSection = caseData.keyDiscoveries?.length
      ? `\n**Sleutelpunten die de student moet achterhalen (hint hier subtiel naar):**\n${caseData.keyDiscoveries.map((kd, i) => `${i + 1}. Wat te achterhalen: "${kd.description}"\n   Hoe te hinten: ${kd.witnessHint}`).join('\n')}`
      : ''

    const systemPrompt = isSuspect
      ? `Je speelt de rol van verdachte in een politieverhoor. Blijf altijd in karakter. Je hebt wettelijk het recht om te zwijgen (art. 29 Sv).

**Identiteit:**
- Naam: ${caseData.witnessName}
- Leeftijd: ${caseData.witnessAge} jaar
- Profiel: ${caseData.witnessProfile}

**Wat jij daadwerkelijk hebt gedaan:**
${caseData.suspectBackground || caseData.backgroundStory}

**Gedragsstijl (niveau ${caseData.cooperationLevel}/5):** ${SUSPECT_STYLE[caseData.cooperationLevel]}

**Wat jij weet / hebt gedaan:**
${caseData.witnessKnows.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}
${keyDiscoveriesSection}

**Regels:**
- Antwoord ALTIJD in het Nederlands
- Blijf consistent — onthoud wat je al hebt gezegd
- Als de agent de cautie nog NIET heeft gegeven (mededeling dat je mag zwijgen), reageer dan normaal
- Als de agent de cautie WEL heeft gegeven, mag je dit erkennen en eventueel gebruik maken van je zwijgrecht
- Geef realistische, menselijke antwoorden — nerveus, defensief of juist kalm afhankelijk van je profiel
- Houd antwoorden beknopt: 1-3 zinnen
- Spreek de agent aan als "agent" of "u"`
      : `Je speelt de rol van getuige in een politieverhoor. Blijf altijd in karakter.

**Identiteit:**
- Naam: ${caseData.witnessName}
- Leeftijd: ${caseData.witnessAge} jaar
- Profiel: ${caseData.witnessProfile}

**Gedragsstijl (niveau ${caseData.cooperationLevel}/5):** ${WITNESS_STYLE[caseData.cooperationLevel]}

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
      model: 'claude-sonnet-4-6',
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
