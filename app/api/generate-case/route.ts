import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { CrimeType, CooperationLevel, IntervieweeType, COOPERATION_DESCRIPTIONS, SUSPECT_COOPERATION_DESCRIPTIONS } from '@/lib/types'

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
    const { crimeType = 'diefstal', cooperationLevel = 2, intervieweeType = 'getuige' }: {
      crimeType?: CrimeType
      cooperationLevel?: CooperationLevel
      intervieweeType?: IntervieweeType
    } = await req.json()

    const legalArticle = CRIME_ARTICLES[crimeType]
    const isSuspect = intervieweeType === 'verdachte'
    const cooperationDesc = isSuspect
      ? SUSPECT_COOPERATION_DESCRIPTIONS[cooperationLevel as CooperationLevel]
      : COOPERATION_DESCRIPTIONS[cooperationLevel as CooperationLevel]

    const prompt = isSuspect
      ? `Genereer een realistisch politietraining-scenario in het Nederlands voor een VERDACHTENVERHOOR.

**Parameters:**
- Misdrijftype: ${crimeType} (${legalArticle})
- Houding verdachte: ${cooperationLevel}/5 — ${cooperationDesc}

**Vereisten:**
- Gebruik een Nederlandse locatie
- Gebruik realistische, diverse Nederlandse namen
- Schrijf een gedetailleerd achtergrondverhaal (150-250 woorden) vanuit politieperspectief
- Beschrijf exact wat de verdachte daadwerkelijk heeft gedaan (suspectBackground)
- Geef 6-8 feiten die de verdachte weet of heeft gedaan
- Maak 3-4 sleutelpunten die de student moet achterhalen
- Bij niveau 1-2: verdachte geeft snel toe; bij 4-5: ontkent alles

Geef UITSLUITEND geldig JSON terug, zonder markdown-opmaak:
{
  "title": "<korte zaaktitel, max 60 tekens>",
  "crimeType": "${crimeType}",
  "legalArticle": "${legalArticle}",
  "intervieweeType": "verdachte",
  "isGuilty": true,
  "description": "<1-2 zinnen objectieve samenvatting>",
  "backgroundStory": "<achtergrond vanuit politieperspectief>",
  "witnessName": "<naam verdachte>",
  "witnessAge": <leeftijd 18-60>,
  "witnessGender": "<'man' of 'vrouw'>",
  "witnessProfile": "<wie is de verdachte: beroep, achtergrond, relatie tot het delict>",
  "suspectBackground": "<exact wat de verdachte heeft gedaan — alleen voor de AI>",
  "witnessKnows": [
    "<wat de verdachte weet of heeft gedaan>",
    "<feit 2>", "<feit 3>", "<feit 4>", "<feit 5>", "<feit 6>"
  ],
  "keyDiscoveries": [
    {
      "description": "<wat de student moet achterhalen>",
      "witnessHint": "<hoe de verdachte dit laat doorschemeren>"
    },
    { "description": "<sleutelpunt 2>", "witnessHint": "<hint>" },
    { "description": "<sleutelpunt 3>", "witnessHint": "<hint>" }
  ],
  "cooperationLevel": ${cooperationLevel}
}`
      : `Genereer een realistisch politietraining-scenario in het Nederlands voor een GETUIGENVERHOOR.

**Parameters:**
- Misdrijftype: ${crimeType} (${legalArticle})
- Coöperativeniveau getuige: ${cooperationLevel}/5 — ${cooperationDesc}

**Vereisten:**
- Gebruik een Nederlandse locatie
- Gebruik realistische, diverse Nederlandse namen
- Schrijf een gedetailleerd achtergrondverhaal (150-250 woorden) met datum, tijdstip, locatie
- Geef 6-8 specifieke feiten die de getuige weet
- Maak 3-4 sleutelpunten die de student moet achterhalen via doorvragen

Geef UITSLUITEND geldig JSON terug, zonder markdown-opmaak:
{
  "title": "<korte zaaktitel, max 60 tekens>",
  "crimeType": "${crimeType}",
  "legalArticle": "${legalArticle}",
  "intervieweeType": "getuige",
  "description": "<1-2 zinnen objectieve samenvatting>",
  "backgroundStory": "<gedetailleerd verhaal over het incident>",
  "witnessName": "<naam getuige>",
  "witnessAge": <leeftijd 20-70>,
  "witnessGender": "<'man' of 'vrouw'>",
  "witnessProfile": "<wie is de getuige: beroep, woonplaats, relatie tot het incident>",
  "witnessKnows": [
    "<specifiek feit>", "<feit 2>", "<feit 3>", "<feit 4>", "<feit 5>", "<feit 6>"
  ],
  "keyDiscoveries": [
    {
      "description": "<wat de student moet achterhalen>",
      "witnessHint": "<hoe de getuige dit hint>"
    },
    { "description": "<sleutelpunt 2>", "witnessHint": "<hint>" },
    { "description": "<sleutelpunt 3>", "witnessHint": "<hint>" }
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
