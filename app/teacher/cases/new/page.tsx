'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { addDoc, collection } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuth } from '@/contexts/AuthContext'
import { Case, CrimeType, CooperationLevel, IntervieweeType, COOPERATION_LABELS, COOPERATION_DESCRIPTIONS, SUSPECT_COOPERATION_LABELS, SUSPECT_COOPERATION_DESCRIPTIONS, KeyDiscovery } from '@/lib/types'
import { Shield, Sparkles, ArrowLeft, Save, Loader2, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'

const CRIME_TYPES: { value: CrimeType; label: string; article: string; notes: string }[] = [
  { value: 'diefstal', label: 'Diefstal', article: 'Art. 310 Sr', notes: 'Wegnemen van goed toebehorend aan een ander' },
  { value: 'inbraak', label: 'Inbraak (gekwal. diefstal)', article: 'Art. 311 Sr', notes: 'Diefstal met braak, verbreking of inklimming' },
  { value: 'straatroof', label: 'Straatroof / Beroving', article: 'Art. 312 Sr', notes: 'Diefstal met geweld of bedreiging' },
  { value: 'mishandeling', label: 'Mishandeling', article: 'Art. 300 Sr', notes: 'Opzettelijk toebrengen van pijn of letsel' },
  { value: 'huiselijk_geweld', label: 'Huiselijk geweld', article: 'Art. 304 Sr', notes: 'Mishandeling in huiselijke kring / gezinsverband' },
  { value: 'bedreiging', label: 'Bedreiging', article: 'Art. 285 Sr', notes: 'Bedreiging met ernstig geweld' },
  { value: 'stalking', label: 'Stalking / Belaging', article: 'Art. 285b Sr', notes: 'Stelselmatig inbreuk op persoonlijke levenssfeer' },
  { value: 'aanranding', label: 'Aanranding / Lastigvallen', article: 'Art. 246 Sr', notes: 'Feitelijke aanranding van de eerbaarheid' },
  { value: 'vernieling', label: 'Vernieling', article: 'Art. 350 Sr', notes: 'Opzettelijk beschadigen/vernielen van goed' },
  { value: 'heling', label: 'Heling', article: 'Art. 416 Sr', notes: 'Verwerven/verkopen van gestolen goederen' },
  { value: 'oplichting', label: 'Oplichting / Fraude', article: 'Art. 326 Sr', notes: 'Bewegen tot afgifte door listige kunstgrepen' },
  { value: 'rijden_onder_invloed', label: 'Rijden onder invloed', article: 'Art. 8 WVW', notes: 'Besturen voertuig onder invloed alcohol/drugs' },
  { value: 'drugs', label: 'Drugsdelict', article: 'Art. 2/3 Opiumwet', notes: 'Bezit, handel of productie van verdovende middelen' },
  { value: 'overig', label: 'Overig', article: '', notes: 'Ander delict — vul wetsartikel handmatig in' },
]

const empty: Partial<Omit<Case, 'id' | 'createdAt' | 'updatedAt'>> = {
  title: '',
  crimeType: 'vernieling',
  legalArticle: 'Art. 350 Sr',
  description: '',
  backgroundStory: '',
  intervieweeType: 'getuige' as IntervieweeType,
  witnessName: '',
  witnessAge: 30,
  witnessGender: 'vrouw' as const,
  witnessProfile: '',
  witnessKnows: ['', '', '', '', '', '', '', ''],
  keyDiscoveries: [],
  cooperationLevel: 2,
  isGuilty: true,
  suspectBackground: '',
  isTemplate: false,
  status: 'draft',
}

function NewCaseInner() {
  const { profile } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isGenerate = searchParams.get('mode') === 'generate'

  const [form, setForm] = useState(empty)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [genCrimeType, setGenCrimeType] = useState<CrimeType>('vernieling')
  const [genCoop, setGenCoop] = useState<CooperationLevel>(2)
  const [genType, setGenType] = useState<IntervieweeType>('getuige')
  const [mode, setMode] = useState<'manual' | 'generate'>(isGenerate ? 'generate' : 'manual')
  const isSuspect = form.intervieweeType === 'verdachte'

  const setField = (key: string, value: unknown) => {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  const setKnows = (i: number, val: string) => {
    const arr = [...(form.witnessKnows || [])]
    arr[i] = val
    setField('witnessKnows', arr)
  }

  const setDiscovery = (i: number, field: keyof KeyDiscovery, val: string) => {
    const arr = [...(form.keyDiscoveries || [])]
    arr[i] = { ...arr[i], [field]: val }
    setField('keyDiscoveries', arr)
  }

  const addDiscovery = () => {
    setField('keyDiscoveries', [...(form.keyDiscoveries || []), { description: '', witnessHint: '' }])
  }

  const removeDiscovery = (i: number) => {
    const arr = [...(form.keyDiscoveries || [])]
    arr.splice(i, 1)
    setField('keyDiscoveries', arr)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/generate-case', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crimeType: genCrimeType, cooperationLevel: genCoop, intervieweeType: genType }),
      })
      const data = await res.json()
      const c = data.case
      setForm({
        ...empty,
        ...c,
        intervieweeType: c.intervieweeType || genType,
        witnessKnows: c.witnessKnows || ['', '', '', '', '', '', '', ''],
        keyDiscoveries: c.keyDiscoveries || [],
      })
      setMode('manual')
    } finally {
      setGenerating(false)
    }
  }

  const handleSave = async (status: 'draft' | 'published') => {
    if (!profile) return
    setSaving(true)
    try {
      const now = new Date().toISOString()
      await addDoc(collection(db, 'cases'), {
        ...form,
        status,
        createdBy: profile.uid,
        isTemplate: false,
        createdAt: now,
        updatedAt: now,
        witnessKnows: (form.witnessKnows || []).filter(k => k.trim()),
        keyDiscoveries: (form.keyDiscoveries || []).filter(kd => kd.description.trim()),
      })
      router.push('/teacher/cases')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/teacher/cases" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-semibold text-gray-900">Nieuwe case</h1>
          </div>
          <div className="flex gap-2">
            <button onClick={() => handleSave('draft')} disabled={saving} className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Opslaan als concept
            </button>
            <button onClick={() => handleSave('published')} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              <Save className="w-4 h-4" />
              {saving ? 'Opslaan...' : 'Publiceren'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Mode selector */}
        <div className="flex rounded-xl overflow-hidden border border-gray-200">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            Handmatig invullen
          </button>
          <button
            onClick={() => setMode('generate')}
            className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${mode === 'generate' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Sparkles className="w-4 h-4" />
            AI genereren
          </button>
        </div>

        {mode === 'generate' && (
          <div className="bg-purple-50 border border-purple-200 rounded-xl p-6 space-y-4">
            <h3 className="font-semibold text-purple-900">AI case genereren</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-purple-800 mb-1">Type interview</label>
                <select value={genType} onChange={e => setGenType(e.target.value as IntervieweeType)}
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  <option value="getuige">Getuigenverhoor</option>
                  <option value="verdachte">Verdachtenverhoor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-purple-800 mb-1">Delictstype</label>
                <select value={genCrimeType} onChange={e => setGenCrimeType(e.target.value as CrimeType)}
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  {CRIME_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-purple-800 mb-1">
                  {genType === 'verdachte' ? 'Houding verdachte' : 'Meewerkingsniveau'}
                </label>
                <select value={genCoop} onChange={e => setGenCoop(parseInt(e.target.value) as CooperationLevel)}
                  className="w-full px-3 py-2 bg-white border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                  {([1,2,3,4,5] as CooperationLevel[]).map(l => (
                    <option key={l} value={l}>{l} — {genType === 'verdachte' ? SUSPECT_COOPERATION_LABELS[l] : COOPERATION_LABELS[l]}</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Genereren...' : 'Genereer case'}
            </button>
          </div>
        )}

        {/* Form */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Type interview</h3>
            <div className="flex rounded-xl overflow-hidden border border-gray-200">
              <button onClick={() => setField('intervieweeType', 'getuige')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${!isSuspect ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Getuigenverhoor
              </button>
              <button onClick={() => setField('intervieweeType', 'verdachte')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${isSuspect ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                Verdachtenverhoor
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">Basisinformatie</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Titel</label>
              <input type="text" value={form.title || ''} onChange={e => setField('title', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bijv. Vernieling parkeerplaats supermarkt" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delictstype</label>
                <select value={form.crimeType || 'vernieling'} onChange={e => {
                  const ct = CRIME_TYPES.find(c => c.value === e.target.value)
                  setField('crimeType', e.target.value)
                  if (ct?.article) setField('legalArticle', ct.article)
                }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {CRIME_TYPES.map(ct => <option key={ct.value} value={ct.value}>{ct.label} — {ct.article || 'handmatig'}</option>)}
                </select>
                {(() => { const ct = CRIME_TYPES.find(c => c.value === form.crimeType); return ct?.notes ? <p className="text-xs text-gray-400 mt-1">{ct.notes}</p> : null })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wetsartikel</label>
                <input type="text" value={form.legalArticle || ''} onChange={e => setField('legalArticle', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Art. 350 Sr" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Korte omschrijving</label>
              <input type="text" value={form.description || ''} onChange={e => setField('description', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Één zin samenvatting" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Achtergrondinformatie</label>
              <textarea value={form.backgroundStory || ''} onChange={e => setField('backgroundStory', e.target.value)} rows={5}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder="Volledige zaakachtergrond: datum, tijd, locatie, wat er is gebeurd..." />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">{isSuspect ? 'Verdachte' : 'Getuige'}</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Naam {isSuspect ? 'verdachte' : 'getuige'}</label>
                <input type="text" value={form.witnessName || ''} onChange={e => setField('witnessName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Maria Janssen" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leeftijd</label>
                <input type="number" value={form.witnessAge || 30} onChange={e => setField('witnessAge', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Geslacht</label>
                <select value={form.witnessGender || 'vrouw'} onChange={e => setField('witnessGender', e.target.value as 'man' | 'vrouw')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="vrouw">Vrouw</option>
                  <option value="man">Man</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Profiel van de {isSuspect ? 'verdachte' : 'getuige'}</label>
              <textarea value={form.witnessProfile || ''} onChange={e => setField('witnessProfile', e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={isSuspect ? 'Wie is de verdachte, achtergrond, motieven...' : 'Wie is de getuige, relatie tot de zaak...'} />
            </div>
            {isSuspect && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wat heeft de verdachte daadwerkelijk gedaan?</label>
                  <textarea value={form.suspectBackground || ''} onChange={e => setField('suspectBackground', e.target.value)} rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Beschrijf exact wat de verdachte heeft gedaan — alleen zichtbaar voor de AI om consistent in karakter te blijven..." />
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.isGuilty ?? true} onChange={e => setField('isGuilty', e.target.checked)} className="w-4 h-4" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Verdachte is schuldig</span>
                    <p className="text-xs text-gray-500">Uitvinken als je een onschuldige verdachte wilt oefenen</p>
                  </div>
                </label>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isSuspect ? 'Houding verdachte' : 'Meewerkingsniveau'}
              </label>
              <div className="space-y-2">
                {([1,2,3,4,5] as CooperationLevel[]).map(l => (
                  <label key={l} className="flex items-start gap-3 cursor-pointer">
                    <input type="radio" name="coop" value={l}
                      checked={form.cooperationLevel === l}
                      onChange={() => setField('cooperationLevel', l)}
                      className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">{l} — {isSuspect ? SUSPECT_COOPERATION_LABELS[l] : COOPERATION_LABELS[l]}</span>
                      <p className="text-xs text-gray-500">{isSuspect ? SUSPECT_COOPERATION_DESCRIPTIONS[l] : COOPERATION_DESCRIPTIONS[l]}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
            <h3 className="font-semibold text-gray-900">Wat weet de getuige?</h3>
            <p className="text-sm text-gray-500">Voer minimaal 5 feiten in die de {isSuspect ? 'verdachte' : 'getuige'} weet. De AI gebruikt dit om in karakter te antwoorden.</p>
            {(form.witnessKnows || []).map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm text-gray-400 w-5">{i+1}.</span>
                <input type="text" value={k} onChange={e => setKnows(i, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`Feit ${i+1}...`} />
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-amber-200 p-6 space-y-4">
            <div>
              <h3 className="font-semibold text-gray-900">Sleutelpunten voor de student</h3>
              <p className="text-sm text-gray-500 mt-1">
                Definieer wat de student moet achterhalen via doorvragen. De getuige geeft hints; de student wordt beoordeeld op of hij deze punten heeft opgespoord en verwerkt in het PV.
              </p>
            </div>
            {(form.keyDiscoveries || []).map((kd, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Sleutelpunt {i + 1}</span>
                  <button onClick={() => removeDiscovery(i)} className="text-amber-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Wat moet de student achterhalen?</label>
                  <input
                    type="text"
                    value={kd.description}
                    onChange={e => setDiscovery(i, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Bijv. De verdachte had een tatoeage op zijn linkerarm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Hoe hint de getuige hier naar? (alleen zichtbaar voor de AI)</label>
                  <input
                    type="text"
                    value={kd.witnessHint}
                    onChange={e => setDiscovery(i, 'witnessHint', e.target.value)}
                    className="w-full px-3 py-2 border border-amber-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                    placeholder="Bijv. Noem terloops iets over een opvallend kenmerk als uiterlijk ter sprake komt"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addDiscovery}
              className="flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-900 px-3 py-2 border border-dashed border-amber-300 rounded-lg w-full justify-center hover:bg-amber-50"
            >
              <Plus className="w-4 h-4" />
              Sleutelpunt toevoegen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function NewCasePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-400">Laden...</div>}>
      <NewCaseInner />
    </Suspense>
  )
}
