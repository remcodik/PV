import { NextRequest, NextResponse } from 'next/server'
import { CrimeType, CooperationLevel } from '@/lib/types'

// MOCK MODE: Anthropic API key niet ingesteld
// Verwijder deze mock en uncomment de echte implementatie zodra je een API key hebt

export async function POST(req: NextRequest) {
  try {
    const { crimeType, cooperationLevel }: {
      crimeType?: CrimeType
      cooperationLevel?: CooperationLevel
    } = await req.json()

    const mockCase = {
      title: "Diefstal fietsen Centraal Station Amsterdam",
      crimeType: crimeType || "diefstal",
      legalArticle: "Art. 310 Sr",
      description: "Een verdachte werd betrapt bij het stelen van fietsen bij Amsterdam Centraal.",
      backgroundStory: `Op dinsdag 14 oktober 2025 om circa 14:30 uur werd door omstanders een man aangehouden op het fietsenstalling aan de noordzijde van Amsterdam Centraal Station. De man, later geïdentificeerd als Mohammad El-Amin (32), had een kniptang bij zich waarmee hij het slot van een fiets had doorgeknipt.\n\nEen passant, mevrouw Fatima Boukhari, had de man al een kwartier in de gaten gehouden omdat zijn gedrag haar verdacht voorkwam. Ze zag hoe hij verschillende fietsen bekeek, de omgeving afzocht en vervolgens een rode stadfiets van het merk Batavus te lijf ging met een kniptang.\n\nNa de aanhouding door twee agenten van de politie Amsterdam bleek de verdachte geen vaste woon- of verblijfplaats te hebben. In zijn rugzak werden nog twee andere fietssloten aangetroffen die vermoedelijk van eerder gestolen fietsen afkomstig zijn.`,
      witnessName: "Fatima Boukhari",
      witnessAge: 34,
      witnessProfile: "Mevrouw Boukhari is woonachtig in Amsterdam-Noord en werkt als verpleegkundige in het AMC. Ze stalt haar fiets dagelijks bij Amsterdam Centraal. Ze is een betrouwbare getuige die het voorval nauwkeurig heeft geobserveerd.",
      witnessKnows: [
        "Ze heeft de verdachte circa 15 minuten lang geobserveerd voordat hij de fiets stal",
        "De verdachte droeg een donkerblauwe jas en een zwarte rugzak",
        "Ze zag duidelijk een kniptang in de hand van de verdachte",
        "De gestolen fiets was een rode Batavus stadsfiets",
        "De diefstal vond plaats om precies 14:27 uur (ze keek op haar telefoon)",
        "Er waren op dat moment circa 10 andere mensen aanwezig in de stalling",
        "De verdachte keek eerst 3 andere fietsen na voordat hij de rode Batavus uitkoos",
        "Ze heeft zelf de politie gebeld via 0900-8844 en de verdachte in de gaten gehouden tot de politie arriveerde"
      ],
      cooperationLevel: cooperationLevel || 2,
    }

    return NextResponse.json({ case: mockCase })
  } catch (error) {
    console.error('Generate case error:', error)
    return NextResponse.json({ error: 'Genereren mislukt' }, { status: 500 })
  }
}
