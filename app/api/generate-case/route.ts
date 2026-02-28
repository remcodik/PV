import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CrimeType, CooperationLevel } from '@/lib/types'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { crimeType, cooperationLevel }: {
      crimeType?: CrimeType
      cooperationLevel?: CooperationLevel
    } = await req.json()

    const crimeHint = crimeType && crimeType !== 'overig'
      ? `Het delict is: ${crimeType}.`
      : 'Kies zelf een realistisch Nederlands delict (vernieling, heling, diefstal, mishandeling, inbraak, of iets anders).'

    const coopHint = cooperationLevel
      ? `Het meewerkingsniveau van de getuige is ${cooperationLevel}/5.`
      : 'Kies zelf een realistisch meewerkingsniveau tussen 1 en 5.'

    const prompt = `Maak een realistische oefencase voor de Nederlandse politieopleiding voor het schrijven van een proces-verbaal.

${crimeHint}
${coopHint}

Geef je antwoord UITSLUITEND als valide JSON in exact dit formaat (geen extra tekst):

{
  "title": "<korte pakkende titel>",
  "crimeType": "<vernieling|heling|diefstal|mishandeling|inbraak|overig>",
  "legalArticle": "<bijv. Art. 350 Sr>",
  "description": "<één zin samenvatting van de zaak>",
  "backgroundStory": "<2-3 alinea's met volledige zaakachtergrond: datum, tijd, locatie, wat er gebeurde, betrokkenen>",
  "witnessName": "<Nederlandse naam>",
  "witnessAge": <leeftijd als getal>,
  "witnessProfile": "<2-3 zinnen over wie de getuige is, relatie tot de zaak>",
  "witnessKnows": [
    "<feit 1 dat de getuige weet>",
    "<feit 2>",
    "<feit 3>",
    "<feit 4>",
    "<feit 5>",
    "<feit 6>",
    "<feit 7>",
    "<feit 8>"
  ],
  "cooperationLevel": <1-5>
}

Richtlijnen:
- Gebruik realistische Nederlandse plaatsnamen, straatnamen en namen
- Gebruik een recente datum (in 2025)
- Zorg dat de zaak voldoende detail bevat voor een volledig PV
- De getuige moet minimaal 8 relevante feiten weten
- Zorg voor een interessante en gevarieerde case`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const caseData = JSON.parse(jsonText)

    return NextResponse.json({ case: caseData })
  } catch (error) {
    console.error('Generate case error:', error)
    return NextResponse.json({ error: 'Genereren mislukt' }, { status: 500 })
  }
}
