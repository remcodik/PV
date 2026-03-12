import { NextRequest, NextResponse } from 'next/server'
import { Case, TranscriptMessage, ScoreBreakdown } from '@/lib/types'
import { scoreToGrade } from '@/lib/utils'

// MOCK MODE: Anthropic API key niet ingesteld
// Verwijder deze mock en uncomment de echte implementatie zodra je een API key hebt

export async function POST(req: NextRequest) {
  try {
    const { pvContent, caseData, transcript }: {
      pvContent: string
      caseData: Case
      transcript: TranscriptMessage[]
    } = await req.json()

    // Simpele mock score gebaseerd op lengte van het PV
    const length = pvContent.length
    const baseScore = Math.min(20, Math.floor(length / 50))

    const scores: ScoreBreakdown = {
      formalia: Math.min(20, baseScore + 10),
      zeven_w: Math.min(30, baseScore + 15),
      getuigenverklaring: Math.min(25, baseScore + 12),
      delictsomschrijving: Math.min(15, baseScore + 7),
      objectiviteit: Math.min(10, baseScore + 5),
    }

    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0)
    const cijfer = scoreToGrade(totalScore)

    const feedback = [
      {
        category: "Formalia",
        score: scores.formalia,
        maxScore: 20,
        feedback: "MOCK: Dit is een testbeoordeling. Voeg een Anthropic API key toe voor echte feedback.",
        suggestions: ["Zorg voor een volledige kop met naam/nummer verbalisant", "Vermeld datum en tijdstip"],
      },
      {
        category: "Zeven W-vragen",
        score: scores.zeven_w,
        maxScore: 30,
        feedback: "MOCK: Controleer of alle zeven W-vragen beantwoord zijn in uw PV.",
        suggestions: ["Wie, Wat, Waar, Wanneer, Waarmee, Waarom, Hoe"],
      },
      {
        category: "Getuigenverklaring",
        score: scores.getuigenverklaring,
        maxScore: 25,
        feedback: "MOCK: Controleer of de getuigenverklaring volledig en verbatim is weergegeven.",
        suggestions: ["Voeg persoonsgegevens getuige toe", "Geef de verklaring letterlijk weer"],
      },
      {
        category: "Delictsomschrijving",
        score: scores.delictsomschrijving,
        maxScore: 15,
        feedback: `MOCK: Controleer of het juiste wetsartikel (${caseData.legalArticle}) is vermeld.`,
        suggestions: ["Vermeld het correcte wetsartikel", "Beschrijf de juridische kwalificatie"],
      },
      {
        category: "Objectiviteit",
        score: scores.objectiviteit,
        maxScore: 10,
        feedback: "MOCK: Controleer of uw PV objectief en feitelijk is geschreven.",
        suggestions: ["Vermijd subjectief taalgebruik", "Scheid feiten van meningen"],
      },
    ]

    return NextResponse.json({
      scores,
      feedback,
      generalFeedback: `MOCK BEOORDELING (${transcript.length} berichten in transcript): Dit is een testbeoordeling zonder AI. Voeg een Anthropic API key toe in .env.local voor echte, inhoudelijke feedback op uw PV.`,
      totalScore,
      cijfer,
    })
  } catch (error) {
    console.error('Evaluate API error:', error)
    return NextResponse.json({ error: 'Evaluatie mislukt' }, { status: 500 })
  }
}
