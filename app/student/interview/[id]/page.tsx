'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Session, Case, TranscriptMessage } from '@/lib/types'
import { Mic, MicOff, Send, StopCircle, Volume2, Shield, User, ArrowRight } from 'lucide-react'

// Web Speech API - webkit prefix fallback
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition
  }
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

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    setSpeechSupported(!!SR)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const sessDoc = await getDoc(doc(db, 'sessions', id))
        if (!sessDoc.exists()) return
        const sessData = { id: sessDoc.id, ...sessDoc.data() } as Session
        setSession(sessData)
        setTranscript(sessData.transcript || [])
        const caseDoc = await getDoc(doc(db, 'cases', sessData.caseId))
        if (caseDoc.exists()) {
          setCaseData({ id: caseDoc.id, ...caseDoc.data() } as Case)
        }
      } catch (err) {
        console.error('fetchData error:', err)
      }
    }
    fetchData()
  }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [transcript])

  const speak = useCallback((text: string) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    utt.lang = 'nl-NL'
    utt.rate = 0.95
    utt.onstart = () => setIsSpeaking(true)
    utt.onend = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utt)
  }, [])

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || !caseData || isLoading) return

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
      const witnessMsg: TranscriptMessage = {
        role: 'witness',
        content: data.reply,
        timestamp: new Date().toISOString(),
      }
      const updatedTranscript = [...newTranscript, witnessMsg]
      setTranscript(updatedTranscript)

      // Save to Firestore
      await updateDoc(doc(db, 'sessions', id), {
        transcript: updatedTranscript,
        status: 'interviewing',
      })

      // Speak witness reply
      speak(data.reply)
    } finally {
      setIsLoading(false)
    }
  }, [transcript, caseData, isLoading, id, speak])

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    window.speechSynthesis?.cancel()
    const recognition = new SR()
    recognition.lang = 'nl-NL'
    recognition.continuous = false
    recognition.interimResults = false

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const text = event.results[0][0].transcript
      setInputText(text)
      sendMessage(text)
    }
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setIsListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  const endInterview = async () => {
    setIsEnding(true)
    await updateDoc(doc(db, 'sessions', id), {
      status: 'writing_pv',
      completedAt: new Date().toISOString(),
      transcript,
    })
    router.push(`/student/pv-editor/${id}`)
  }

  if (!session || !caseData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-gray-900 text-sm">{caseData.title}</h1>
              <p className="text-xs text-gray-500">Interview met {caseData.witnessName}</p>
            </div>
          </div>
          <button
            onClick={endInterview}
            disabled={isEnding || transcript.length === 0}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            {isEnding ? 'Bezig...' : 'PV schrijven'}
          </button>
        </div>
      </header>

      {/* Case briefing banner */}
      <div className="bg-blue-50 border-b border-blue-100 px-6 py-3">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-blue-800">
            <strong>Zaak:</strong> {caseData.description} — <strong>Wetsartikel:</strong> {caseData.legalArticle}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {transcript.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 text-sm">
                Stel je voor als agent en begin het interview met {caseData.witnessName}.<br />
                Gebruik de microfoon of typ je vraag hieronder.
              </p>
            </div>
          )}

          {transcript.map((msg, i) => (
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
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                msg.role === 'student'
                  ? 'bg-blue-600 text-white rounded-tr-sm'
                  : 'bg-white border border-gray-200 text-gray-900 rounded-tl-sm'
              }`}>
                <p className="text-sm leading-relaxed">{msg.content}</p>
                <p className={`text-xs mt-1 ${msg.role === 'student' ? 'text-blue-200' : 'text-gray-400'}`}>
                  {msg.role === 'student' ? 'Agent' : caseData.witnessName}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
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
          {isListening && (
            <p className="text-center text-xs text-red-500 mt-2 animate-pulse">
              Luisteren... Klik op Stop om te stoppen
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
