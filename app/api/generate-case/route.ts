import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CrimeType, CooperationLevel, COOPERATION_DESCRIPTIONS } from '@/lib/types'

const client = new Anthropic()

const CRIME_ARTICLES: Record<string, string> = {
  vernieling: 'Art. 350 Sr',
  heling: 'Art. 416 Sr',
  diefstal: 'Art. 310 Sr',
  mishandeling: 'Art. 300 Sr',
  inbraak: 'Art. 311 Sr',
  overig: 'Art. 300 Sr',
}

export async function POST(req: NextRequest) {
  try {
    const { crimeType = 'diefstal', cooperationLevel = 2 }: {
      crimeType?: CrimeType
      cooperationLevel?: CooperationLevel
    } = await req.json()

    const legalArticle = CRIME_ARTICLES[crimeType]
    const cooperationDesc = COOPERATION_DESCRIPTIONS[cooperationLevel as CooperationLevel]

    const prompt = `Genereer een realistisch politietraining-scenario in het Nederlands voor studenten van de politieopleiding.

**Parameters:**
- Misdrijftype: ${crimeType} (${legalArticle})
- Coöperativeniveau getuige: ${cooperationLevel}/5 — ${cooperationDesc}

**Vereisten:**
- Gebruik een Nederlandse locatie (stad, straat, wijk)
- Gebruik realistische, diverse Nederlandse namen
- Schrijf een gedetailleerd achtergrondverhaal (150-250 woorden) met datum, tijdstip, locatie en verloop
- Geef 6-8 specifieke feiten die de getuige weet (aangepast aan het coöperativeniveau)
- Maak 3-4 sleutelpunten die de student moet achterhalen via doorvragen
  - Bij niveau 1-2: hints zijn relatief direct
  - Bij niveau 3: hints zijn vaag en vereisen doorvragen
  - Bij niveau 4-5: getuige hint nauwelijks, vereist gerichte en aanhoudende vragen

Geef UITSLUITEND geldig JSON terug, zonder markdown-opmaak of extra tekst:
{
  "title": "<korte zaaktitel, max 60 tekens>",
  "crimeType": "${crimeType}",
  "legalArticle": "${legalArticle}",
  "description": "<1-2 zinnen objectieve samenvatting van de zaak>",
  "backgroundStory": "<gedetailleerd verhaal over het incident>",
  "witnessName": "<volledige naam van de getuige>",
  "witnessAge": <leeftijd tussen 20 en 70>,
  "witnessProfile": "<wie is deze persoon: beroep, woonplaats, relatie tot het incident>",
  "witnessKnows": [
    "<specifiek feit dat de getuige weet>",
    "<specifiek feit>",
    "<specifiek feit>",
    "<specifiek feit>",
    "<specifiek feit>",
    "<specifiek feit>"
  ],
  "keyDiscoveries": [
    {
      "description": "<wat de student moet achterhalen, bijv. 'De verdachte had een opvallend kenmerk'>",
      "witnessHint": "<hoe de getuige dit hint, bijv. 'Noem dit spontaan als uiterlijk ter sprake komt'>"
    },
    {
      "description": "<tweede sleutelpunt>",
      "witnessHint": "<hoe te hinten>"
    },
    {
      "description": "<derde sleutelpunt>",
      "witnessHint": "<hoe te hinten>"
    }
  ],
  "cooperationLevel": ${cooperationLevel}
}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Geen JSON in AI-respons')
    const generatedCase = JSON.parse(jsonMatch[0])

    if (!generatedCase?.title) throw new Error('Ongeldige AI-respons: titel ontbreekt')

    // Ensure keyDiscoveries is always an array
    if (!Array.isArray(generatedCase.keyDiscoveries)) {
      generatedCase.keyDiscoveries = []
    }

    return NextResponse.json({ case: generatedCase })
  } catch (error) {
    console.error('Generate case error:', error)
    return NextResponse.json({ error: 'Genereren mislukt' }, { status: 500 })
  }
}
