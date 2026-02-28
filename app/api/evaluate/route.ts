import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Case, TranscriptMessage, ScoreBreakdown, FeedbackItem } from '@/lib/types'
import { scoreToGrade } from '@/lib/utils'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const { pvContent, caseData, transcript }: {
      pvContent: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    const transcriptText = transcript
      .map(m => `${m.role === 'student' ? 'Agent' : 'Getuige'}: ${m.content}`)
      .join('\n')

    const prompt = `Je bent een ervaren politieopleider die een proces-verbaal (PV) beoordeelt van een student-agent.

## ZAAKGEGEVENS (de grondfeiten):
${caseData.backgroundStory}

## WAT DE GETUIGE WEET:
${caseData.witnessKnows.join('\n')}

## HET GEVOERDE INTERVIEW (transcript):
${transcriptText}

## HET INGEDIENDE PROCES-VERBAAL:
${pvContent}

## BEOORDELINGSOPDRACHT:
Beoordeel het PV op de volgende 5 categorieën en geef een score en feedback. Geef je antwoord UITSLUITEND als valide JSON in exact dit formaat:

{
  "scores": {
    "formalia": <0-20>,
    "zeven_w": <0-30>,
    "getuigenverklaring": <0-25>,
    "delictsomschrijving": <0-15>,
    "objectiviteit": <0-10>
  },
  "feedback": [
    {
      "category": "Formalia",
      "score": <0-20>,
      "maxScore": 20,
      "feedback": "<wat goed/fout ging>",
      "suggestions": ["<verbeterpunt 1>", "<verbeterpunt 2>"]
    },
    {
      "category": "Zeven W-vragen",
      "score": <0-30>,
      "maxScore": 30,
      "feedback": "<wat goed/fout ging>",
      "suggestions": ["<verbeterpunt 1>", "<verbeterpunt 2>"]
    },
    {
      "category": "Getuigenverklaring",
      "score": <0-25>,
      "maxScore": 25,
      "feedback": "<wat goed/fout ging>",
      "suggestions": ["<verbeterpunt 1>", "<verbeterpunt 2>"]
    },
    {
      "category": "Delictsomschrijving",
      "score": <0-15>,
      "maxScore": 15,
      "feedback": "<wat goed/fout ging>",
      "suggestions": ["<verbeterpunt 1>", "<verbeterpunt 2>"]
    },
    {
      "category": "Objectiviteit",
      "score": <0-10>,
      "maxScore": 10,
      "feedback": "<wat goed/fout ging>",
      "suggestions": ["<verbeterpunt 1>", "<verbeterpunt 2>"]
    }
  ],
  "generalFeedback": "<algemene feedback in 2-3 zinnen>"
}

## BEOORDELINGSCRITERIA:

**Formalia (20 punten):**
- Kop met vermelding van verbalisant/agent (naam/nummer) (4 pt)
- Datum, tijdstip en locatie van het incident (4 pt)
- Datum van opmaken PV (3 pt)
- Wettelijke basis (art. 152/153 Sv) of ambtseed vermelding (3 pt)
- Ondertekening/afsluiting (3 pt)
- Professionele opmaak en opbouw (3 pt)

**Zeven W-vragen (30 punten, 4-5 pt per W):**
- WIE: identiteit verdachte en/of slachtoffer (5 pt)
- WAT: wat is er precies gebeurd/gestolen/beschadigd (5 pt)
- WAAR: exacte locatie (4 pt)
- WANNEER: datum en tijdstip (4 pt)
- WAARMEE: gebruikte middelen/werktuig (4 pt)
- WAAROM: motief/opzet indien bekend (4 pt)
- HOE: werkwijze/modus operandi (4 pt)

**Getuigenverklaring (25 punten):**
- Naam en persoonsgegevens getuige (5 pt)
- Verbatim weergave van de verklaring (10 pt)
- Volledigheid (alle relevante informatie uit het transcript) (7 pt)
- Correcte weergave (geen verdraaiing) (3 pt)

**Delictsomschrijving (15 punten):**
- Correct wetsartikel vermeld (${caseData.legalArticle}) (7 pt)
- Correcte juridische kwalificatie van het feit (5 pt)
- Bestanddelen delict aanwezig (3 pt)

**Objectiviteit (10 punten):**
- Geen subjectief taalgebruik (4 pt)
- Geen conclusies door verbalisant (3 pt)
- Feiten gescheiden van meningen (3 pt)

Antwoord ALLEEN met de JSON, geen extra tekst.`

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    // Strip markdown code blocks if present
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(jsonText)

    const totalScore = Object.values(result.scores as ScoreBreakdown).reduce((a, b) => a + b, 0)
    const cijfer = scoreToGrade(totalScore)

    return NextResponse.json({
      scores: result.scores,
      feedback: result.feedback,
      generalFeedback: result.generalFeedback,
      totalScore,
      cijfer,
    })
  } catch (error) {
    console.error('Evaluate API error:', error)
    return NextResponse.json({ error: 'Evaluatie mislukt' }, { status: 500 })
  }
}
