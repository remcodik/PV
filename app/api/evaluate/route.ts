export const maxDuration = 60
export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Case, TranscriptMessage, ScoreBreakdown, FeedbackItem, SCORE_CATEGORY_LABELS } from '@/lib/types'
import { scoreToGrade } from '@/lib/utils'
import { requireAuth, AuthError, adminDb, checkAiUsageCap } from '@/lib/firebase-admin'
import { loadOwnedSession, SessionError } from '@/lib/server-session'

const CRIME_ELEMENTS: Record<string, string> = {
  vernieling: 'Bestanddelen art. 350 Sr: opzet + beschadigen/vernielen/onbruikbaar maken + goed toebehorend aan ander.',
  diefstal: 'Bestanddelen art. 310 Sr: wegnemen + goed toebehorend aan ander + oogmerk wederrechtelijke toe-eigening.',
  inbraak: 'Bestanddelen art. 311 Sr: diefstal + braak/verbreking/inklimming/valse sleutel/valse order/verdichte naam.',
  straatroof: 'Bestanddelen art. 312 Sr: diefstal + geweld/bedreiging met geweld vóór/tijdens/na het feit.',
  mishandeling: 'Bestanddelen art. 300 Sr: opzet + toebrengen pijn/letsel/ziekelijke stoornis/zwakheid.',
  huiselijk_geweld: 'Bestanddelen art. 304 Sr: mishandeling (art. 300 Sr) + kwalificerende omstandigheid (familielid/huisgenoot). Vermeld relatie partijen.',
  bedreiging: 'Bestanddelen art. 285 Sr: bedreiging met misdrijf tegen leven/zwaar lichamelijk letsel + redelijke vrees inboezemen. Exacte bewoordingen opnemen.',
  stalking: 'Bestanddelen art. 285b Sr: stelselmatig + inbreuk persoonlijke levenssfeer + opzet vrees/nadeel. Vermeld duur, frequentie en middelen.',
  aanranding: 'Bestanddelen art. 246 Sr: feitelijke aanranding eerbaarheid + dwang/geweld/bedreiging. Exacte handeling beschrijven zonder waardeoordeel.',
  heling: 'Bestanddelen art. 416 Sr: verwerven/voorhanden hebben/overdragen + uit misdrijf afkomstig + wetenschap of redelijk vermoeden.',
  oplichting: 'Bestanddelen art. 326 Sr: listige kunstgrepen/samenweefsel verdichtsels + bewegen tot afgifte/dienst/aangaan schuld. Beschrijf de truc.',
  rijden_onder_invloed: 'Bestanddelen art. 8 WVW: besturen motorrijtuig op weg + onder invloed (alcohol ≥0,5‰ of drugs). Vermeld ademanalyse/bloedafname-resultaat.',
  drugs: 'Bestanddelen Opiumwet: middel op lijst I (harddrugs) of II (softdrugs) + handeling (bezit/verkoop/productie/aanwezig hebben). Vermeld hoeveelheid en verpakking.',
}

const client = new Anthropic()

const SYSTEM_PROMPT = `Je bent een ervaren docent bij de Nederlandse politieopleiding. Je beoordeelt Processen-Verbaal (PV's) van studenten op zes criteria. Geef eerlijke, constructieve feedback in het Nederlands.

## Beoordelingscriteria

### 1. Formalia (max. 15 punten)
- Volledige kop: naam/rang verbalisant, dienstnummer, datum, tijdstip, locatie
- Verwijzing naar art. 152/153 Sv (of art. 163 Sv bij rijden onder invloed)
- Bij verdachtenverhoor: vermeld of student de cautie heeft gegeven (art. 29 Sv)
- Correcte afsluiting en ondertekening
- Professionele opmaak en structuur

### 2. Zeven W-vragen (max. 25 punten)
Alle zeven vragen beantwoord in de bevindingen:
- Wie (dader/slachtoffer/getuigen — persoonsgegevens)
- Wat (wat is er precies gebeurd)
- Waar (exacte locatie)
- Wanneer (datum, tijdstip)
- Waarmee (gebruikte middelen/wapen/voertuig)
- Waarom (motief indien bekend)
- Hoe (modus operandi)

### 3. Verklaring getuige/verdachte (max. 20 punten)
- Persoonsgegevens volledig vermeld
- Verklaring verbatim weergegeven (letterlijke woorden)
- Volledigheid verklaring t.o.v. wat betrokkene heeft medegedeeld
- Duidelijke scheiding tussen bevindingen en verklaring
- Bij verdachte: zwijgrecht/ontkenning correct genoteerd

### 4. Delictsomschrijving (max. 15 punten)
- Correct wetsartikel vermeld
- Alle bestanddelen van het specifieke delict beschreven (zie zaakgegevens)
- Juridisch correcte kwalificatie
- Koppeling van feiten aan de rechtsnorm
- Let op delictspecifieke vereisten (bijv. braak bij inbraak, geweld bij straatroof, stelselmatigheid bij stalking)

### 5. Objectiviteit (max. 10 punten)
- Zakelijk en feitelijk taalgebruik
- Geen subjectieve oordelen of meningen
- Feiten en verklaringen gescheiden
- Geen onnodige waardeoordelen

### 6. Doorvragen & Sleutelpunten (max. 15 punten)
- Heeft de student de sleutelpunten achterhaald?
- Zijn de sleutelpunten opgenomen in het PV?
- Heeft de student doorgevraagd op hints?
- Bij verdachteninterview: heeft de student effectief doorgevraagd ondanks ontkenning/zwijgen?
Beoordeel zowel het transcript als het PV.

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
    const { uid } = await requireAuth(req)
    await checkAiUsageCap('evaluate')
    const body: {
      sessionId?: string
      pvContent: string
      caseData?: Case
      transcript?: TranscriptMessage[]
    } = await req.json()
    const { pvContent } = body

    // Case and transcript are loaded server-side from the student's own
    // session — never trusted from the client — and the resulting report
    // is written here with the Admin SDK. Students can no longer create
    // pvreports directly (see firestore.rules), so a grade can't be forged
    // by writing scores from the browser or by sending an easier caseData.
    //
    // Exception: local_ sessions (offline fallback, never stored in
    // Firestore) still send caseData/transcript; their result is returned
    // but not persisted, so it never reaches a teacher view.
    let caseData: Case
    let transcript: TranscriptMessage[]
    let persistSessionId: string | null = null

    if (body.sessionId && !body.sessionId.startsWith('local_')) {
      const loaded = await loadOwnedSession(uid, body.sessionId)
      caseData = loaded.caseData
      transcript = loaded.session.transcript
      persistSessionId = body.sessionId
    } else {
      if (!body.caseData || !body.transcript) {
        return NextResponse.json({ error: 'sessionId ontbreekt.' }, { status: 400 })
      }
      caseData = body.caseData
      transcript = body.transcript
    }

    // Teacher-set attention note/focus areas are read server-side by the
    // authenticated uid — never trusted from the client — so a student
    // can't tamper with their own note to influence grading.
    let teacherGuidance = ''
    try {
      const profileSnap = await adminDb()!.collection('profiles').doc(uid).get()
      const p = profileSnap.exists ? profileSnap.data() : null
      const note = p?.attentionNote as string | undefined
      const focusAreas = p?.focusAreas as (keyof ScoreBreakdown)[] | undefined
      if (note || focusAreas?.length) {
        const focusLabels = focusAreas?.map(f => SCORE_CATEGORY_LABELS[f]).join(', ')
        teacherGuidance = `\n## Docentinstructie voor deze student (weeg mee in de beoordeling)\n${
          note ? `${note}\n` : ''
        }${focusLabels ? `Extra aandacht vereist voor: ${focusLabels}.` : ''}`
      }
    } catch {
      // Non-fatal — evaluation proceeds without teacher guidance if this fails
    }

    const transcriptText = transcript
      .map(m => `${m.role === 'student' ? 'Agent' : caseData.witnessName}: ${m.content}`)
      .join('\n')

    const keyDiscoveriesText = caseData.keyDiscoveries?.length
      ? `\n## Sleutelpunten die student moest achterhalen\n${caseData.keyDiscoveries.map((kd, i) => `${i + 1}. ${kd.description}`).join('\n')}`
      : '\n## Sleutelpunten\nGeen specifieke sleutelpunten gedefinieerd voor deze case.'

    const isSuspect = caseData.intervieweeType === 'verdachte'
    const intervieweeLabel = isSuspect ? 'Verdachte' : 'Getuige'
    const cautieNote = isSuspect
      ? '\n## Verdachtenverhoor\nBeoordeel of de student de cautie heeft gegeven (art. 29 Sv: mededeling dat verdachte niet verplicht is te antwoorden). Vermeld dit bij Formalia. Beoordeel ook of student effectief doorvroeg ondanks ontkenning/zwijgen.'
      : ''
    const crimeElements = CRIME_ELEMENTS[caseData.crimeType]
      ? `\n## Delictspecifieke bestanddelen\n${CRIME_ELEMENTS[caseData.crimeType]}\nBeoordeel bij Delictsomschrijving of alle bestanddelen in het PV zijn opgenomen.`
      : ''

    const userMessage = `## Te beoordelen PV

${pvContent}

## Zaakgegevens

Zaak: ${caseData.title}
Type interview: ${intervieweeLabel}verhoor
Delict: ${caseData.crimeType} (${caseData.legalArticle})
Achtergrond: ${caseData.backgroundStory}
${keyDiscoveriesText}${cautieNote}${crimeElements}${teacherGuidance}

## Interview transcript

${transcriptText}`

    const callModel = () => client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        }
      ],
      messages: [{ role: 'user', content: userMessage }],
    })

    const parseResponse = (text: string): Record<string, unknown> | null => {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) return null
      try {
        return JSON.parse(jsonMatch[0])
      } catch {
        // Response was truncated — try to extract scores at minimum
        const scoresMatch = text.match(/"scores"\s*:\s*\{([^}]+)\}/)
        if (scoresMatch) {
          try {
            const scoresObj = JSON.parse(`{${scoresMatch[0]}}`)
            return { scores: scoresObj.scores, feedback: [], generalFeedback: 'Beoordeling gedeeltelijk beschikbaar.' }
          } catch {
            return null
          }
        }
        return null
      }
    }

    let response = await callModel()
    let text = response.content[0].type === 'text' ? response.content[0].text : '{}'
    let result = parseResponse(text)

    // Retry once if the model's response didn't parse at all (not just the
    // truncated-but-salvageable case above) — a single malformed response
    // shouldn't mean the student gets no evaluation at all.
    if (!result?.scores) {
      response = await callModel()
      text = response.content[0].type === 'text' ? response.content[0].text : '{}'
      result = parseResponse(text)
    }

    if (!result?.scores) throw new Error('Geen geldige scores in AI-respons')

    const rawScores = result.scores as Record<string, unknown>
    const toScore = (val: unknown, max: number) => {
      const n = typeof val === 'number' ? val : Number(val)
      return Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0
    }
    const scores: ScoreBreakdown = {
      formalia: toScore(rawScores.formalia, 15),
      zeven_w: toScore(rawScores.zeven_w, 25),
      getuigenverklaring: toScore(rawScores.getuigenverklaring, 20),
      delictsomschrijving: toScore(rawScores.delictsomschrijving, 15),
      objectiviteit: toScore(rawScores.objectiviteit, 10),
      doorvragen: toScore(rawScores.doorvragen, 15),
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
    const cijfer = scoreToGrade(totalScore)

    // Defensive: if the model's feedback array is missing or malformed,
    // don't let that crash the results page — fall back to an empty array
    // rather than passing through whatever shape came back.
    const feedback = Array.isArray(result.feedback) ? (result.feedback as FeedbackItem[]) : []
    const generalFeedback = typeof result.generalFeedback === 'string'
      ? result.generalFeedback
      : 'Beoordeling afgerond.'

    let reportId: string | null = null
    if (persistSessionId) {
      const db = adminDb()!
      const now = new Date().toISOString()
      const reportData = {
        sessionId: persistSessionId,
        caseId: caseData.id,
        studentId: uid,
        content: pvContent,
        totalScore,
        cijfer,
        scoresBreakdown: scores,
        feedback,
        generalFeedback,
        submittedAt: now,
        evaluatedAt: now,
      }
      const existing = await db.collection('pvreports').where('sessionId', '==', persistSessionId).limit(1).get()
      if (!existing.empty) {
        await existing.docs[0].ref.set(reportData)
        reportId = existing.docs[0].id
      } else {
        reportId = (await db.collection('pvreports').add(reportData)).id
      }
      await db.collection('sessions').doc(persistSessionId).update({ status: 'evaluated', pvContent })
    }

    return NextResponse.json({
      scores,
      feedback,
      generalFeedback,
      totalScore,
      cijfer,
      reportId,
    })
  } catch (error) {
    if (error instanceof AuthError || error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Evaluate API error:', error)
    return NextResponse.json({ error: 'Evaluatie mislukt' }, { status: 500 })
  }
}
