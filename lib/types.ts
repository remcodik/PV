export type UserRole = 'student' | 'teacher'

export interface UserProfile {
  uid: string
  email: string
  name: string
  role: UserRole
  createdAt: string
}

export type CooperationLevel = 1 | 2 | 3 | 4 | 5

export const COOPERATION_LABELS: Record<CooperationLevel, string> = {
  1: 'Zeer coöperatief',
  2: 'Coöperatief',
  3: 'Neutraal',
  4: 'Terughoudend',
  5: 'Niet coöperatief',
}

export const COOPERATION_DESCRIPTIONS: Record<CooperationLevel, string> = {
  1: 'Geeft alle informatie spontaan en helpt de politie actief.',
  2: 'Beantwoordt vragen direct maar geeft geen extra informatie.',
  3: 'Antwoordt minimaal, soms vaag, moet worden doorgevraagd.',
  4: 'Aarzelt, geeft incomplete antwoorden, soms tegenstrijdig.',
  5: 'Vijandig, weigert sommige vragen te beantwoorden, tegenstrijdig.',
}

export type CrimeType = 'vernieling' | 'heling' | 'diefstal' | 'mishandeling' | 'inbraak' | 'overig'

export interface Case {
  id: string
  title: string
  crimeType: CrimeType
  legalArticle: string
  description: string
  backgroundStory: string
  witnessName: string
  witnessAge: number
  witnessProfile: string
  witnessKnows: string[]
  cooperationLevel: CooperationLevel
  isTemplate: boolean
  status: 'draft' | 'published'
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TranscriptMessage {
  role: 'student' | 'witness'
  content: string
  timestamp: string
}

export type SessionStatus = 'assigned' | 'interviewing' | 'writing_pv' | 'submitted' | 'evaluated'

export interface Session {
  id: string
  caseId: string
  caseTitle: string
  studentId: string
  studentName: string
  assignedBy?: string
  status: SessionStatus
  transcript: TranscriptMessage[]
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export interface ScoreBreakdown {
  formalia: number        // 0-20
  zeven_w: number         // 0-30
  getuigenverklaring: number  // 0-25
  delictsomschrijving: number // 0-15
  objectiviteit: number   // 0-10
}

export interface FeedbackItem {
  category: string
  score: number
  maxScore: number
  feedback: string
  suggestions: string[]
}

export interface PVReport {
  id: string
  sessionId: string
  caseId: string
  studentId: string
  content: string
  totalScore: number        // 0-100
  cijfer: number            // 1-10
  scoresBreakdown: ScoreBreakdown
  feedback: FeedbackItem[]
  generalFeedback: string
  submittedAt: string
  evaluatedAt?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}
