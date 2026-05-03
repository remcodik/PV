'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, Case, TranscriptMessage } from '@/lib/types'
import { BUILTIN_CASES } from '@/lib/cases'
import { Mic, MicOff, Send, StopCircle, Volume2, Shield, User, ArrowRight, ArrowLeft, Cpu } from 'lucide-react'

// Web Speech API - webkit prefix fallback
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition
  }
}

const now = new Date().toISOString()
const MEMORY_CASES: Case[] = BUILTIN_CASES.map((c, i) => ({
  ...c,
  id: `builtin_${i}`,
  createdAt: now,
  updatedAt: now,
}))

function loadLocalSession(id: string): Session | null {
  try {
    const raw = localStorage.getItem(`session_${id}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function saveLocalSession(session: Session) {
  try {
    localStorage.setItem(`session_${session.id}`, JSON.stringify(session))
  } catch {}
}

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  const [caseData, setCaseData] = useState<Case | null>(null)
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isEnding, setIsEnding] = useState(false)
  const [speechSupported, setSpeechSupported] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [ttsMode, setTtsMode] = useState<'browser' | 'ai'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tts_mode') as 'browser' | 'ai') ?? 'browser'
    }
    return 'browser'
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const isLocal = id.startsWith('local_')

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechSupported(!!SR)
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) setVoices(v)
    }
    loadVoices()
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices)
    // Safari fallback: poll for voices if voiceschanged never fires
    const poll = setInterval(() => {
      const v = window.speechSynthesis.getVoices()
      if (v.length > 0) { setVoices(v); clearInterval(poll) }
    }, 200)
    setTimeout(() => clearInterval(poll), 3000)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices)
      clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Local session — load from localStorage
        if (isLocal) {
          const localSess = loadLocalSession(id)
          if (!localSess) return
          setSession(localSess)
          setTranscript(localSess.transcript || [])
          // Find case from memory
          const memCase = MEMORY_CASES.find(c => c.id === localSess.caseId)
          if (memCase) {
            setCaseData(memCase)
          } else {
            // Try Firestore as fallback
            try {
              const caseDoc = await getDoc(doc(db, 'cases', localSess.caseId))
              if (caseDoc.exists()) setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
            } catch {}
          }
          return
        }

        // Firestore session
        const sessDoc = await getDoc(doc(db, 'sessions', id))
        if (!sessDoc.exists()) { setLoadError(true); return }
        const sessData = { id: sessDoc.id, ...sessDoc.data() } as Session
        setSession(sessData)
        setTranscript(sessData.transcript || [])

        // Load case — check memory first if builtin_ id
        if (sessData.caseId.startsWith('builtin_')) {
          const memCase = MEMORY_CASES.find(c => c.id === sessData.caseId)
          if (memCase) { setCaseData(memCase); return }
        }
        const caseDoc = await getDoc(doc(db, 'cases', sessData.caseId))
        if (caseDoc.exists()) {
          setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
        }
      } catch (err) {
        console.error('fetchData error:', err)
        setLoadError(true)
      }
    }
    fetchData()
  }, [id, isLocal])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const getBestVoice = useCallback((gender: 'man' | 'vrouw'): SpeechSynthesisVoice | null => {
    const nlVoices = voices.filter(v => v.lang.startsWith('nl'))
    if (!nlVoices.length) return null
    // Priority order: Safari (claire/xander) → Edge Neural (roos/fenna/frank/maarten) → iOS enhanced → any nl
    const femalePriority = ['claire', 'roos', 'fenna', 'colette', 'lotte', 'anna', 'female']
    const malePriority = ['xander', 'frank', 'maarten', 'ruben', 'wim', 'willem', 'male']
    const keywords = gender === 'vrouw' ? femalePriority : malePriority
    // Find by keyword priority — check each keyword in order so best match wins
    let named: SpeechSynthesisVoice | undefined
    for (const k of keywords) {
      named = nlVoices.find(v => v.name.toLowerCase().includes(k))
      if (named) break
    }
    if (named) return named
    const neural = nlVoices.find(v => v.name.toLowerCase().includes('online') || v.name.toLowerCase().includes('natural') || v.name.toLowerCase().includes('neural') || v.name.toLowerCase().includes('enhanced'))
    if (neural) return neural
    return nlVoices[0]
  }, [voices])

  const speakBrowser = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    const spokenText = text.replace(/\*[^*]+\*/g, '').trim()
    if (!spokenText) return
    window.speechSynthesis.cancel()
    const gender = caseData?.witnessGender ?? 'vrouw'
    const voice = getBestVoice(gender)
    // Warn if no Dutch voice found
    if (!voice) setTtsError('Geen Nederlandse stem gevonden — installeer Nederlands stemmenpack via Instellingen → Toegankelijkheid → Gesproken inhoud → Stemmen')
    else setTtsError(null)
    // iOS needs longer delay after cancel()
    setTimeout(() => {
      const utt = new SpeechSynthesisUtterance(spokenText)
      if (voice) {
        utt.voice = voice
        utt.lang = voice.lang
      }
      // No lang fallback if voice missing — avoids iOS silent failure on nl-NL without Dutch voice
      utt.rate = 0.92
      utt.pitch = gender === 'vrouw' ? 1.1 : 0.9
      utt.onstart = () => setIsSpeaking(true)
      utt.onend = () => setIsSpeaking(false)
      utt.onerror = () => setIsSpeaking(false)
      window.speechSynthesis.speak(utt)
    }, 300)
  }, [caseData, getBestVoice])

  const speakAI = useCallback(async (text: string) => {
    if (!caseData) return
    const spokenText = text.replace(/\*[^*]+\*/g, '').trim()
    if (!spokenText) return
    setTtsError(null)
    setIsSpeaking(true)
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: spokenText, gender: caseData.witnessGender }),
      })
      if (res.status === 503) {
        setTtsError('AI-stem niet beschikbaar (geen API key) — browserstem gebruikt')
        setIsSpeaking(false)
        speakBrowser(text)
        return
      }
      if (!res.ok) throw new Error('TTS mislukt')
      setTtsError(null)
      const arrayBuffer = await res.arrayBuffer()
      // Use AudioContext for iOS compatibility (audio.play() blocked async on iOS)
      const ctx = audioCtxRef.current ?? new AudioContext()
      audioCtxRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      const source = ctx.createBufferSource()
      source.buffer = audioBuffer
      source.connect(ctx.destination)
      source.onended = () => setIsSpeaking(false)
      source.start(0)
    } catch {
      setTtsError('AI-stem mislukt — browserstem gebruikt')
      setIsSpeaking(false)
      speakBrowser(text)
    }
  }, [caseData, speakBrowser])

  const speak = useCallback((text: string) => {
    if (ttsMode === 'ai') speakAI(text)
    else speakBrowser(text)
  }, [ttsMode, speakAI, speakBrowser])

  const toggleTtsMode = useCallback(() => {
    setTtsMode(prev => {
      const next = prev === 'browser' ? 'ai' : 'browser'
      localStorage.setItem('tts_mode', next)
      return next
    })
  }, [])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !caseData || isLoading) return
    // Unlock AudioContext from user gesture so iOS allows async audio play
    if (typeof window !== 'undefined' && window.AudioContext) {
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext()
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume()
    }

    const userMsg: TranscriptMessage = {
      role: 'student',
      content: message.trim(),
      timestamp: new Date().toISOString(),
    }

    const newTranscript = [...transcript, userMsg]
    setTranscript(newTranscript)
    setInputText('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          caseData,
          transcript,
        }),
      })
      const data = await res.json()
      if (!res.ok || !data.reply) throw new Error(data.error || 'Chat mislukt')
      setApiError(null)
      const witnessMsg: TranscriptMessage = {
        role: 'witness',
        content: data.reply,
        timestamp: new Date().toISOString(),
      }
      const updatedTranscript = [...newTranscript, witnessMsg]
      setTranscript(updatedTranscript)

      // Save transcript — Firestore or localStorage
      if (isLocal && session) {
        const updated = { ...session, transcript: updatedTranscript }
        saveLocalSession(updated)
        setSession(updated)
      } else {
        try {
          await updateDoc(doc(db, 'sessions', id), {
            transcript: updatedTranscript,
            status: 'interviewing',
          })
        } catch {
          // Firestore sync failed — save to localStorage so transcript isn't lost
          if (session) {
            const updated = { ...session, transcript: updatedTranscript }
            saveLocalSession(updated)
            setSession(updated)
          }
        }
      }

      speak(data.reply)
    } catch (err) {
      console.error('sendMessage error:', err)
      setApiError('Geen antwoord ontvangen — probeer opnieuw.')
    } finally {
      setIsLoading(false)
    }
  }, [transcript, caseData, isLoading, id, isLocal, session, speak])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    // Stop any ongoing speech synthesis
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)

    // Stop any existing recognition session first
    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    const recognition = new SR()
    recognition.lang = 'nl-NL'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript
      setInputText(text)
      setIsListening(false)
      recognitionRef.current = null
      // Use setTimeout so state has time to update before sending
      setTimeout(() => sendMessage(text), 100)
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error)
      setIsListening(false)
      recognitionRef.current = null
    }

    try {
      recognitionRef.current = recognition
      recognition.start()
      setIsListening(true)
    } catch (err) {
      console.error('Failed to start recognition:', err)
      recognitionRef.current = null
      setIsListening(false)
    }
  }, [sendMessage])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsListening(false)
  }, [])

  const endInterview = async () => {
    setIsEnding(true)
    if (isLocal && session) {
      const updated = { ...session, status: 'writing_pv' as const, completedAt: new Date().toISOString(), transcript }
      saveLocalSession(updated)
    } else {
      try {
        await updateDoc(doc(db, 'sessions', id), {
          status: 'writing_pv',
          completedAt: new Date().toISOString(),
          transcript,
        })
      } catch {}
    }
    router.push(`/student/pv-editor/${id}`)
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <p className="text-gray-700 font-medium mb-2">Interview kon niet worden geladen</p>
          <p className="text-gray-500 text-sm mb-4">Controleer je internetverbinding en probeer opnieuw.</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
            Opnieuw proberen
          </button>
        </div>
      </div>
    )
  }

  if (!session || !caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => router.push('/student/dashboard')}
              className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-1"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Shield className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-gray-900 text-sm truncate">{caseData.title}</h1>
              <p className="text-xs text-gray-500 truncate">{caseData.intervieweeType === 'verdachte' ? 'Verdachtenverhoor' : 'Getuigenverhoor'} — {caseData.witnessName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* TTS toggle */}
            <button
              onClick={toggleTtsMode}
              title={ttsMode === 'ai' ? 'AI-stem actief — klik voor browserstem' : 'Browserstem actief — klik voor AI-stem'}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                ttsMode === 'ai'
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-white text-gray-600 border-gray-300'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>{ttsMode === 'ai' ? 'AI' : 'Browser'}</span>
            </button>
            <button
              onClick={endInterview}
              disabled={isEnding || transcript.length === 0}
              title={transcript.length === 0 ? 'Voer eerst een interview — stel minstens één vraag' : 'Interview afsluiten en PV schrijven'}
              className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>{isEnding ? 'Bezig...' : 'PV schrijven'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Case briefing banner */}
      <div className="bg-blue-50 border-b border-blue-100 px-4 sm:px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-blue-800">
            <strong>Zaak:</strong> {caseData.description} — <strong>Wetsartikel:</strong> {caseData.legalArticle}
          </p>
        </div>
      </div>

      {/* Witness avatar */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-4">
          <div className="relative flex-shrink-0">
            {caseData.witnessPhoto ? (
              <img
                src={caseData.witnessPhoto}
                alt={caseData.witnessName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <div className={`w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold ${
                caseData.witnessGender === 'man' ? 'bg-blue-500' : 'bg-rose-400'
              }`}>
                {caseData.witnessName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
            )}
            {isSpeaking && (
              <>
                <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{backgroundColor: caseData.witnessGender === 'man' ? '#3b82f6' : '#fb7185'}} />
                <span className="absolute -inset-1 rounded-full border-2 animate-pulse" style={{borderColor: caseData.witnessGender === 'man' ? '#3b82f6' : '#fb7185'}} />
              </>
            )}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{caseData.witnessName}</p>
            <p className="text-sm text-gray-500">{caseData.witnessAge} jaar · {caseData.intervieweeType === 'verdachte' ? '🔴 Verdachte' : 'Getuige'} · {caseData.witnessProfile.split('.')[0]}</p>
            {isSpeaking && (
              <div className="flex items-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{animationDelay:'0ms'}} />
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{animationDelay:'150ms'}} />
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-bounce" style={{animationDelay:'300ms'}} />
                <span className="text-xs text-green-600 ml-1">spreekt...</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {transcript.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500 text-sm">
                Stel je voor als agent en begin het interview met {caseData.witnessName}.<br />
                Gebruik de microfoon of typ je vraag hieronder.
              </p>
            </div>
          )}

          {transcript.map((msg, i) => {
            // Split witness messages into spoken text and *action* parts
            const parts = msg.role === 'witness'
              ? (() => {
                  const result: {type: 'text'|'action', content: string}[] = []
                  const regex = /\*([^*]+)\*/g
                  let last = 0, m: RegExpExecArray | null
                  while ((m = regex.exec(msg.content)) !== null) {
                    if (m.index > last) result.push({type: 'text', content: msg.content.slice(last, m.index).trim()})
                    result.push({type: 'action', content: m[1].trim()})
                    last = m.index + m[0].length
                  }
                  const tail = msg.content.slice(last).trim()
                  if (tail) result.push({type: 'text', content: tail})
                  return result.filter(p => p.content)
                })()
              : null

            return (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === 'student' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'student' ? 'bg-blue-600' : 'bg-gray-200'
                }`}>
                  {msg.role === 'student'
                    ? <Shield className="w-4 h-4 text-white" />
                    : <User className="w-4 h-4 text-gray-600" />}
                </div>
                <div className="max-w-[75%] space-y-1">
                  {msg.role === 'witness' && parts ? (
                    <>
                      {parts.map((p, j) => p.type === 'action' ? (
                        <div key={j} className="text-xs text-gray-400 italic px-3 py-1 bg-gray-50 border border-gray-100 rounded-xl inline-block">
                          *{p.content}*
                        </div>
                      ) : (
                        <div key={j} className="bg-white border border-gray-200 text-gray-900 rounded-2xl rounded-tl-sm px-4 py-3">
                          <p className="text-sm leading-relaxed">{p.content}</p>
                        </div>
                      ))}
                      <p className="text-xs text-gray-400 px-1">{caseData.witnessName}</p>
                    </>
                  ) : (
                    <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3">
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                      <p className="text-xs mt-1 text-blue-200">Agent</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                  </div>
                  <span className="text-xs text-gray-400 ml-1">Antwoord komt...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 sm:px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            {isSpeaking && (
              <div className="flex items-center gap-1.5 text-sm text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                <Volume2 className="w-4 h-4 animate-pulse" />
                Spreekt...
              </div>
            )}
            <div className="flex-1 flex items-center gap-2 bg-gray-100 rounded-xl px-4 py-2.5">
              <input
                type="text"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(inputText)}
                placeholder="Typ je vraag of gebruik de microfoon..."
                className="flex-1 bg-transparent text-sm focus:outline-none"
                disabled={isLoading}
              />
              <button
                onClick={() => sendMessage(inputText)}
                disabled={!inputText.trim() || isLoading}
                className="text-blue-600 disabled:text-gray-300"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {speechSupported && (
              <button
                onClick={isListening ? stopListening : startListening}
                disabled={isLoading}
                className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isListening ? <StopCircle className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
            )}
          </div>
          {transcript.length === 0 && !isListening && (
            <p className="text-center text-xs text-gray-400 mt-2">
              Stel je eerste vraag om het interview te starten — daarna kun je een PV schrijven.
            </p>
          )}
          {isListening && (
            <p className="text-center text-xs text-red-500 mt-2 animate-pulse">
              Luisteren... Klik op Stop om te stoppen
            </p>
          )}
          {apiError && (
            <p className="text-center text-xs text-red-500 mt-2">{apiError}</p>
          )}
          {ttsError && (
            <p className="text-center text-xs text-orange-500 mt-2">{ttsError}</p>
          )}
        </div>
      </div>
    </div>
  )
}
