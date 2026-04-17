export const maxDuration = 60
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Case, TranscriptMessage, ScoreBreakdown, FeedbackItem } from '@/lib/types'
import { scoreToGrade } from '@/lib/utils'

const client = new Anthropic()

const SYSTEM_PROMPT = `Je bent een ervaren docent bij de Nederlandse politieopleiding. Je beoordeelt Processen-Verbaal (PV's) van studenten op zes criteria. Geef eerlijke, constructieve feedback in het Nederlands.

## Beoordelingscriteria

### 1. Formalia (max. 15 punten)
- Volledige kop: naam/rang verbalisant, dienstnummer, datum, tijdstip, locatie
- Verwijzing naar art. 152/153 Sv
- Correcte afsluiting en ondertekening
- Professionele opmaak en structuur

### 2. Zeven W-vragen (max. 25 punten)
Alle zeven vragen beantwoord in de bevindingen:
- Wie (dader/slachtoffer/getuigen)
- Wat (wat is er precies gebeurd)
- Waar (exacte locatie)
- Wanneer (datum, tijdstip)
- Waarmee (gebruikte middelen/wapen)
- Waarom (motief indien bekend)
- Hoe (modus operandi)

### 3. Getuigenverklaring (max. 20 punten)
- Persoonsgegevens getuige volledig vermeld
- Verklaring verbatim weergegeven (letterlijke woorden getuige)
- Volledigheid verklaring t.o.v. wat getuige heeft medegedeeld
- Duidelijke scheiding tussen bevindingen en getuigenverklaring

### 4. Delictsomschrijving (max. 15 punten)
- Correct wetsartikel vermeld
- Alle bestanddelen van het delict beschreven
- Juridisch correcte kwalificatie
- Koppeling van feiten aan de rechtsnorm

### 5. Objectiviteit (max. 10 punten)
- Zakelijk en feitelijk taalgebruik
- Geen subjectieve oordelen of meningen
- Feiten en verklaringen gescheiden
- Geen onnodige waardeoordelen

### 6. Doorvragen & Sleutelpunten (max. 15 punten)
- Heeft de student de sleutelpunten achterhaald die de getuige moest onthullen?
- Zijn de sleutelpunten opgenomen in het PV (bevindingen of getuigenverklaring)?
- Heeft de student doorgevraagd op hints van de getuige?
Beoordeel zowel het transcript (werden de vragen gesteld?) als het PV (zijn de punten opgenomen?).

## Outputformaat
Geef je beoordeling UITSLUITEND als geldig JSON, zonder markdown-opmaak of extra tekst:
{
  "scores": {
    "formalia": <0-15>,
    "zeven_w": <0-25>,
    "getuigenverklaring": <0-20>,
    "delictsomschrijving": <0-15>,
    "objectiviteit": <0-10>,
    "doorvragen": <0-15>
  },
  "feedback": [
    {
      "category": "Formalia",
      "score": <getal>,
      "maxScore": 15,
      "feedback": "<inhoudelijke beoordeling op basis van het ingediende PV>",
      "suggestions": ["<concrete, specifieke tip>", "<concrete, specifieke tip>"]
    },
    {
      "category": "Zeven W-vragen",
      "score": <getal>,
      "maxScore": 25,
      "feedback": "<inhoudelijke beoordeling>",
      "suggestions": ["<tip>"]
    },
    {
      "category": "Getuigenverklaring",
      "score": <getal>,
      "maxScore": 20,
      "feedback": "<inhoudelijke beoordeling>",
      "suggestions": ["<tip>"]
    },
    {
      "category": "Delictsomschrijving",
      "score": <getal>,
      "maxScore": 15,
      "feedback": "<inhoudelijke beoordeling>",
      "suggestions": ["<tip>"]
    },
    {
      "category": "Objectiviteit",
      "score": <getal>,
      "maxScore": 10,
      "feedback": "<inhoudelijke beoordeling>",
      "suggestions": ["<tip>"]
    },
    {
      "category": "Doorvragen & Sleutelpunten",
      "score": <getal>,
      "maxScore": 15,
      "feedback": "<inhoudelijke beoordeling: welke sleutelpunten zijn achterhaald, welke niet>",
      "suggestions": ["<tip>"]
    }
  ],
  "generalFeedback": "<algemene samenvatting: sterke punten, verbeterpunten, en eindadvies>"
}`

export async function POST(req: NextRequest) {
  try {
    const { pvContent, caseData, transcript }: {
      pvContent: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    const transcriptText = transcript
      .map(m => `${m.role === 'student' ? 'Agent' : caseData.witnessName}: ${m.content}`)
      .join('\n')

    const keyDiscoveriesText = caseData.keyDiscoveries?.length
      ? `\n## Sleutelpunten die student moest achterhalen\n${caseData.keyDiscoveries.map((kd, i) => `${i + 1}. ${kd.description}`).join('\n')}`
      : '\n## Sleutelpunten\nGeen specifieke sleutelpunten gedefinieerd voor deze case.'

    const userMessage = `## Te beoordelen PV

${pvContent}

## Zaakgegevens

Zaak: ${caseData.title}
Delict: ${caseData.crimeType} (${caseData.legalArticle})
Achtergrond: ${caseData.backgroundStory}
${keyDiscoveriesText}

## Interview transcript

${transcriptText}`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        }
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Geen JSON in AI-respons')
    const result = JSON.parse(jsonMatch[0])

    if (!result?.scores) throw new Error('Ongeldige AI-respons: scores ontbreken')

    const scores: ScoreBreakdown = {
      formalia: Math.min(15, Math.max(0, result.scores.formalia ?? 0)),
      zeven_w: Math.min(25, Math.max(0, result.scores.zeven_w ?? 0)),
      getuigenverklaring: Math.min(20, Math.max(0, result.scores.getuigenverklaring ?? 0)),
      delictsomschrijving: Math.min(15, Math.max(0, result.scores.delictsomschrijving ?? 0)),
      objectiviteit: Math.min(10, Math.max(0, result.scores.objectiviteit ?? 0)),
      doorvragen: Math.min(15, Math.max(0, result.scores.doorvragen ?? 0)),
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
    const cijfer = scoreToGrade(totalScore)

    return NextResponse.json({
      scores,
      feedback: result.feedback as FeedbackItem[],
      generalFeedback: result.generalFeedback,
      totalScore,
      cijfer,
    })
  } catch (error) {
    console.error('Evaluate API error:', error)
    return NextResponse.json({ error: 'Evaluatie mislukt' }, { status: 500 })
  }
}
